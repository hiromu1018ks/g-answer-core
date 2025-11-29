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
        const { question, query_embedding } = await req.json();

        if (!query_embedding) {
            throw new Error("query_embedding is required");
        }

        // 2. Supabaseでハイブリッド検索 (RPC呼び出し)
        const authHeader = req.headers.get("Authorization");
        const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
            global: { headers: { Authorization: authHeader! } },
        });

        const { data: documents, error } = await supabase.rpc("hybrid_search", {
            query_text: question,
            query_embedding: query_embedding,
            match_count: 5,
        });

        if (error) throw error;

        // 3. コンテキスト整形
        const contextText = documents
            .map((doc: any) => `[参照ID:${doc.id}] 内容: ${doc.content}`)
            .join("\n\n");

        // 4. Geminiで答弁生成
        const genResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `あなたは自治体職員です。以下の資料に基づいて、質問に対する答弁案を作成してください。\n\n【資料】\n${contextText}\n\n【質問】\n${question}\n\n【出力要件】\n- 議会答弁らしい丁寧な口調で。\n- 必ず引用元の[参照ID]を明記すること。`
                        }]
                    }]
                }),
            }
        );

        if (!genResp.ok) {
            const errorData = await genResp.text();
            console.error("Gemini API Error:", errorData);
            throw new Error(`Gemini API Error: ${genResp.status} ${genResp.statusText} - ${errorData}`);
        }

        const genData = await genResp.json();
        const answer = genData.candidates[0].content.parts[0].text;

        return new Response(JSON.stringify({ answer, references: documents }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Edge Function Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
