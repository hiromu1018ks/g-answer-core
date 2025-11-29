import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // フロントエンドから { title, chunks } を受け取る
    // chunks は [{ content: "...", page: 1 }, ...] の形式
    const { title, chunks, source_type } = await req.json();

    // Supabaseクライアント作成 (ユーザーのAuth情報を引き継ぐ)
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader! } },
    });

    // ユーザー取得
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth Error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized", details: userError }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. 親ドキュメントを作成
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        title,
        source_type,
        user_id: user.id // user_idを明示的に指定
      })
      .select()
      .single();

    if (docError) {
      console.error("Database Insert Error:", docError);
      throw docError;
    }

    // 2. バッチ処理でベクトル化と保存 (Gemini API limit: 100 items per batch, but payload size matters too)
    const BATCH_SIZE = 10; // Reduced to avoid payload size limits
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);

      // Gemini Batch Embedding Request
      const batchRequests = batchChunks.map(chunk => ({
        model: "models/text-embedding-004",
        content: { parts: [{ text: chunk.content }] },
        taskType: "RETRIEVAL_DOCUMENT",
      }));

      console.log(`Processing batch ${i / BATCH_SIZE + 1}, size: ${batchChunks.length}`);

      const embedResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests: batchRequests }),
        }
      );

      if (!embedResp.ok) {
        const errorText = await embedResp.text();
        console.error("Gemini API Error Status:", embedResp.status);
        console.error("Gemini API Error Body:", errorText);
        throw new Error(`Gemini API Error (${embedResp.status}): ${errorText}`);
      }

      const embedData = await embedResp.json();
      const embeddings = embedData.embeddings; // Array of { values: [...] }

      if (!embeddings || embeddings.length !== batchChunks.length) {
        throw new Error("Mismatch in embedding results count");
      }

      // Prepare DB Insert Data
      const insertData = batchChunks.map((chunk, index) => ({
        document_id: doc.id,
        content: chunk.content,
        page_number: chunk.page,
        embedding: embeddings[index].values
      }));

      // Batch Insert to DB
      const { error: sectionError } = await supabase.from('document_sections').insert(insertData);

      if (sectionError) {
        console.error("Batch Insert Error:", sectionError);
        throw sectionError;
      }
    }

    return new Response(JSON.stringify({ success: true, docId: doc.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Internal Server Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
