# **自治体議会答弁作成支援アプリ『G-Answer Core』仕様書**

**Version:** 2.3 (AI-Agent Ready / Final Fix)

作成日: 2025年11月29日  
更新: データのベクトル化フロー（Embedding）の欠落を修正。AIエージェントが自走可能な状態へ最適化。

## **1\. プロジェクト概要**

### **1.1 背景**

自治体職員の業務において、議会答弁書の作成は極めて高い正確性と過去の経緯との整合性が求められる。既存の業務フローでは、膨大な過去資料の検索と整合性チェックに多大な時間を要している。

### **1.2 目的**

「調査・起案・校閲」をワンストップで完結させるアプリ『G-Answer Core』を開発する。  
本仕様書では、\*\*キーワード検索とベクトル検索（意味検索）を組み合わせた「ハイブリッド検索」\*\*を実装し、表記ゆれに強く、高精度な回答生成を実現する要件を定義する。

## **2\. システム要件と技術スタック**

Supabaseの機能を最大限活用し、Pythonサーバーレスで構築する。

| 項目 | 選定技術 | 選定理由 |
| :---- | :---- | :---- |
| **プラットフォーム** | Webブラウザ | インストール不要。 |
| **フロントエンド** | React | 高速なUI。 |
| **ファイル解析** | pdf.js / mammoth.js | ブラウザ内でテキスト抽出。（※Wordファイル推奨） |
| **AI (生成・埋め込み)** | Google Gemini API | gemini-2.5-flash (生成), text-embedding-004 (ベクトル化) |
| **検索・DB** | **Supabase (PostgreSQL)** | pg\_trgm (全文検索) と pgvector (ベクトル検索) を併用。 |
| **バックエンド** | **Supabase Edge Functions** | APIキー隠蔽のため、**「回答生成」と「データ保存（ベクトル化）」の両方**をサーバーサイドで行う。 |

## **3\. 機能要件詳細**

### **3.1 ナレッジ・ベース（Intelligence）**

#### **(1) スマート・インポート（データ登録フロー）**

* **ファイル読み込み:** PDF/Word/Textに対応。  
* **チャンク分割:** 文脈維持のため、オーバーラップを持たせて分割する（サイズ1000文字 / 重複200文字）。  
* **ベクトル化保存:** 分割されたテキストをEdge Function (embed-text) に送信する。Function側でGemini APIを叩いてベクトル化し、DBに保存する。**（※フロントエンドから直接DBへInsertしないこと）**

#### **(2) ハイブリッド検索システム**

* **キーワード検索 (FTS):** 単語の一致を検索。  
* **ベクトル検索 (Vector):** 意味の近さを検索。  
* **統合:** 2つの結果を統合し、上位の関連資料をAIに渡す。

### **3.2 答弁ワークスペース（Workspace）**

#### **(1) エビデンス付きドラフト生成**

* **引用元の明示:** 回答生成AIに対し、根拠資料のIDと該当箇所を明記させる。

## **4\. データ管理・保存設計**

### **4.1 データベース構造**

Supabaseにて vector, pg\_trgm 拡張機能を有効化する。

テーブル: document\_sections  
| カラム名 | 型 | 説明 |  
| :--- | :--- | :--- |  
| id | UUID | PK |  
| document\_id | UUID | FK \-\> documents.id |  
| content | TEXT | 本文 |  
| fts | TSVECTOR | 全文検索用インデックス |  
| embedding | VECTOR(768) | Gemini Embeddings用ベクトルデータ |

## **5\. 付録A: Supabase構築用SQLスクリプト**

Supabaseの「SQL Editor」で実行してください。

\-- 1\. 拡張機能  
create extension if not exists vector;  
create extension if not exists pg\_trgm;

\-- 2\. テーブル作成  
create table documents (  
  id uuid primary key default gen\_random\_uuid(),  
  user\_id uuid references auth.users(id) on delete cascade not null,  
  title text not null,  
  source\_type text,  
  created\_at timestamp with time zone default now()  
);

create table document\_sections (  
  id uuid primary key default gen\_random\_uuid(),  
  document\_id uuid references documents(id) on delete cascade not null,  
  content text not null,  
  page\_number int,  
  token\_count int,  
  fts tsvector generated always as (to\_tsvector('japanese', content)) stored,  
  embedding vector(768)  
);

create table drafts (  
  id uuid primary key default gen\_random\_uuid(),  
  user\_id uuid references auth.users(id) on delete cascade not null,  
  question text,  
  answer\_body text,  
  status text default 'draft',  
  referenced\_section\_ids jsonb,  
  updated\_at timestamp with time zone default now()  
);

\-- 3\. インデックス  
create index on document\_sections using gin (fts);  
create index on document\_sections using hnsw (embedding vector\_cosine\_ops);

\-- 4\. RLS (セキュリティ)  
alter table documents enable row level security;  
alter table document\_sections enable row level security;  
alter table drafts enable row level security;

create policy "Users can only see their own documents" on documents for all using (auth.uid() \= user\_id);  
create policy "Users can only see sections of their own documents" on document\_sections for all using (exists (select 1 from documents where documents.id \= document\_sections.document\_id and documents.user\_id \= auth.uid()));  
create policy "Users can only see their own drafts" on drafts for all using (auth.uid() \= user\_id);

\-- 5\. ハイブリッド検索関数  
create or replace function hybrid\_search(  
  query\_text text,  
  query\_embedding vector(768),  
  match\_count int  
)  
returns setof document\_sections  
language plpgsql  
as $$  
begin  
  return query (  
    select \* from document\_sections  
    where document\_id in (select id from documents where user\_id \= auth.uid())  
    order by embedding \<=\> query\_embedding asc  
    limit match\_count  
  )  
  union distinct  
  (  
    select \* from document\_sections  
    where document\_id in (select id from documents where user\_id \= auth.uid())  
    and fts @@ websearch\_to\_tsquery('japanese', query\_text)  
    order by ts\_rank(fts, websearch\_to\_tsquery('japanese', query\_text)) desc  
    limit match\_count  
  );  
end;  
$$;

## **6\. 付録B: Supabase Edge Functions (Backend)**

supabase functions new embed-text と supabase functions new generate-answer で作成してください。

**共通: 必要な環境変数 (.env)**

* GEMINI\_API\_KEY: Google AI Studioのキー  
* SUPABASE\_URL: プロジェクトURL  
* SUPABASE\_ANON\_KEY: Anon Key

### **(1) Function: embed-text (データ保存用)**

**重要:** フロントエンドから送られたテキストをベクトル化してDBに保存します。

Path: supabase/functions/embed-text/index.ts

import { serve } from "\[https://deno.land/std@0.168.0/http/server.ts\](https://deno.land/std@0.168.0/http/server.ts)";  
import { createClient } from "\[https://esm.sh/@supabase/supabase-js@2\](https://esm.sh/@supabase/supabase-js@2)";

const GEMINI\_API\_KEY \= Deno.env.get("GEMINI\_API\_KEY");  
const SUPABASE\_URL \= Deno.env.get("SUPABASE\_URL");  
const SUPABASE\_ANON\_KEY \= Deno.env.get("SUPABASE\_ANON\_KEY");

serve(async (req) \=\> {  
  try {  
    // フロントエンドから { title, chunks } を受け取る  
    // chunks は \[{ content: "...", page: 1 }, ...\] の形式  
    const { title, chunks, source\_type } \= await req.json();

    // Supabaseクライアント作成 (ユーザーのAuth情報を引き継ぐ)  
    const authHeader \= req.headers.get("Authorization");  
    const supabase \= createClient(SUPABASE\_URL\!, SUPABASE\_ANON\_KEY\!, {  
      global: { headers: { Authorization: authHeader\! } },  
    });

    // 1\. 親ドキュメントを作成  
    const { data: doc, error: docError } \= await supabase  
      .from('documents')  
      .insert({ title, source\_type })  
      .select()  
      .single();  
      
    if (docError) throw docError;

    // 2\. 各チャンクをベクトル化して保存  
    for (const chunk of chunks) {  
      // GeminiでEmbedding生成  
      const embedResp \= await fetch(  
        \`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI\_API\_KEY}\`,  
        {  
          method: "POST",  
          headers: { "Content-Type": "application/json" },  
          body: JSON.stringify({  
            model: "models/text-embedding-004",  
            content: { parts: \[{ text: chunk.content }\] },  
          }),  
        }  
      );  
      const embedData \= await embedResp.json();  
        
      if (\!embedData.embedding) {  
        console.error("Embedding Error", embedData);  
        continue;  
      }

      // DBに保存  
      await supabase.from('document\_sections').insert({  
        document\_id: doc.id,  
        content: chunk.content,  
        page\_number: chunk.page,  
        embedding: embedData.embedding.values // ここでベクトルが入る  
      });  
    }

    return new Response(JSON.stringify({ success: true, docId: doc.id }), {  
      headers: { "Content-Type": "application/json" },  
    });

  } catch (error) {  
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });  
  }  
});

### **(2) Function: generate-answer (回答生成用)**

Path: supabase/functions/generate-answer/index.ts

import { serve } from "\[https://deno.land/std@0.168.0/http/server.ts\](https://deno.land/std@0.168.0/http/server.ts)";  
import { createClient } from "\[https://esm.sh/@supabase/supabase-js@2\](https://esm.sh/@supabase/supabase-js@2)";

const GEMINI\_API\_KEY \= Deno.env.get("GEMINI\_API\_KEY");  
const SUPABASE\_URL \= Deno.env.get("SUPABASE\_URL");  
const SUPABASE\_ANON\_KEY \= Deno.env.get("SUPABASE\_ANON\_KEY");

serve(async (req) \=\> {  
  try {  
    const { question } \= await req.json();

    // 1\. 質問文のベクトル化  
    const embedResp \= await fetch(  
      \`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI\_API\_KEY}\`,  
      {  
        method: "POST",  
        headers: { "Content-Type": "application/json" },  
        body: JSON.stringify({  
          model: "models/text-embedding-004",  
          content: { parts: \[{ text: question }\] },  
        }),  
      }  
    );  
    const embedData \= await embedResp.json();  
    const queryEmbedding \= embedData.embedding.values;

    // 2\. Supabaseでハイブリッド検索 (RPC呼び出し)  
    const authHeader \= req.headers.get("Authorization");  
    const supabase \= createClient(SUPABASE\_URL\!, SUPABASE\_ANON\_KEY\!, {  
      global: { headers: { Authorization: authHeader\! } },  
    });

    const { data: documents, error } \= await supabase.rpc("hybrid\_search", {  
      query\_text: question,  
      query\_embedding: queryEmbedding,  
      match\_count: 5,  
    });

    if (error) throw error;

    // 3\. コンテキスト整形  
    const contextText \= documents  
      .map((doc: any) \=\> \`\[参照ID:${doc.id}\] 内容: ${doc.content}\`)  
      .join("\\n\\n");

    // 4\. Geminiで答弁生成  
    const genResp \= await fetch(  
      \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI\_API\_KEY}\`,  
      {  
        method: "POST",  
        headers: { "Content-Type": "application/json" },  
        body: JSON.stringify({  
          contents: \[{  
            parts: \[{  
              text: \`あなたは自治体職員です。以下の資料に基づいて、質問に対する答弁案を作成してください。\\n\\n【資料】\\n${contextText}\\n\\n【質問】\\n${question}\\n\\n【出力要件】\\n- 議会答弁らしい丁寧な口調で。\\n- 必ず引用元の\[参照ID\]を明記すること。\`  
            }\]  
          }\]  
        }),  
      }  
    );  
      
    const genData \= await genResp.json();  
    const answer \= genData.candidates\[0\].content.parts\[0\].text;

    return new Response(JSON.stringify({ answer, references: documents }), {  
      headers: { "Content-Type": "application/json" },  
    });

  } catch (error) {  
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });  
  }  
});

## **7\. 付録C: Frontend Logic (React)**

フロントエンドは「分割」までを行い、DBへの保存はEdge Functionに委任する。

Path: src/utils/textProcessor.js

/\*\*  
 \* テキストを指定文字数で分割し、オーバーラップを持たせる関数  
 \*/  
export const splitTextWithOverlap \= (text, chunkSize \= 1000, overlap \= 200\) \=\> {  
  if (\!text) return \[\];  
  const chunks \= \[\];  
  let startIndex \= 0;  
  while (startIndex \< text.length) {  
    let endIndex \= startIndex \+ chunkSize;  
    if (endIndex \> text.length) endIndex \= text.length;  
    chunks.push(text.slice(startIndex, endIndex));  
    if (endIndex \=== text.length) break;  
    startIndex \= endIndex \- overlap;  
  }  
  return chunks;  
};

/\*\*  
 \* データの保存処理（Edge Functionを呼び出す）  
 \* ※ 直接DBインサートではなく、embed-text APIを呼ぶ  
 \*/  
export const saveDocument \= async (supabase, file, text) \=\> {  
  // 1\. テキストを分割  
  const rawChunks \= splitTextWithOverlap(text);  
    
  // 2\. 送信用の形式に整形  
  const chunks \= rawChunks.map((c, index) \=\> ({  
    content: c,  
    page: 1 // 将来的にPDF解析結果からページ数を取得して入れる  
  }));

  // 3\. Edge Functionを呼び出し  
  const { data, error } \= await supabase.functions.invoke('embed-text', {  
    body: {  
      title: file.name,  
      source\_type: 'file',  
      chunks: chunks  
    }  
  });

  if (error) throw error;  
  return data;  
};  