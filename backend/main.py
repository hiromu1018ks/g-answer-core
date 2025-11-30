from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sentence_transformers import SentenceTransformer, CrossEncoder
from supabase import create_client, Client
import google.generativeai as genai
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env.local in the root directory
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

app = FastAPI()

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Model (Multilingual E5 Base)
model = SentenceTransformer('intfloat/multilingual-e5-base')

# Initialize Cross-Encoder for Re-ranking
reranker = CrossEncoder('cross-encoder/mmarco-mMiniLMv2-L12-H384-v1')

# Initialize Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
# Supabase Client
# Use Service Role Key to bypass RLS for backend operations
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    print("Error: SUPABASE_URL not set in environment.")
if not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_SERVICE_ROLE_KEY not set in environment. RLS bypass will fail.")

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration (Service Role Key) missing on server")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

class Chunk(BaseModel):
    content: str
    page: int

class EmbedRequest(BaseModel):
    title: str
    source_type: str
    chunks: List[Chunk]
    user_id: str

class QueryRequest(BaseModel):
    query: str

@app.post("/embed_document")
async def embed_document(req: EmbedRequest):
    try:
        supabase = get_supabase()
        
        # 1. Create Document
        doc_data = {
            "title": req.title,
            "source_type": req.source_type,
            "user_id": req.user_id
        }
        res = supabase.table("documents").insert(doc_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create document")
        
        doc_id = res.data[0]['id']
        
        # 2. Embed and Insert Sections
        # Prepare texts for embedding. E5 requires "passage: " prefix for docs.
        texts = [f"passage: {chunk.content}" for chunk in req.chunks]
        
        # Batch embedding
        embeddings = model.encode(texts, normalize_embeddings=True)
        
        sections_data = []
        for i, chunk in enumerate(req.chunks):
            sections_data.append({
                "document_id": doc_id,
                "content": chunk.content,
                "page_number": chunk.page,
                "embedding": embeddings[i].tolist()
            })
            
        # Batch insert (Supabase can handle fairly large batches, but let's chunk if huge)
        BATCH_SIZE = 100
        for i in range(0, len(sections_data), BATCH_SIZE):
            batch = sections_data[i:i+BATCH_SIZE]
            supabase.table("document_sections").insert(batch).execute()
            
        return {"success": True, "docId": doc_id}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embed_query")
async def embed_query(req: QueryRequest):
    try:
        # E5 requires "query: " prefix for queries
        text = f"query: {req.query}"
        embedding = model.encode(text, normalize_embeddings=True)
        return {"embedding": embedding.tolist()}
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class GenerateRequest(BaseModel):
    question: str
    user_id: str

@app.post("/generate_answer")
async def generate_answer(request: GenerateRequest):
    try:
        supabase = get_supabase()
        
        # 1. Embed the question
        # E5 requires "query: " prefix
        query_text = f"query: {request.question}"
        query_embedding = model.encode(query_text, normalize_embeddings=True).tolist()

        # 2. Hybrid Search via Supabase
        params = {
            "query_text": request.question,
            "query_embedding": query_embedding,
            "match_count": 50,  # Fetch more candidates for re-ranking
            "filter_user_id": request.user_id
        }
        
        response = supabase.rpc("hybrid_search", params).execute()
        
        if not response.data:
            return {"answer": "関連する資料が見つかりませんでした。", "references": []}
            
        documents = response.data

        # 3. Re-ranking
        doc_pairs = [[request.question, doc['content']] for doc in documents]
        scores = reranker.predict(doc_pairs)
        
        for i, doc in enumerate(documents):
            doc['score'] = float(scores[i])
            
        ranked_documents = sorted(documents, key=lambda x: x['score'], reverse=True)[:5]
        
        # 4. Generate Answer with Gemini
        context_text = "\n\n".join([f"[参照ID:{doc['id']}] 内容: {doc['content']}" for doc in ranked_documents])
        
        prompt = f"""あなたは自治体職員です。以下の資料に基づいて、質問に対する答弁案を作成してください。

【資料】
{context_text}

【質問】
{request.question}

【出力要件】
- 議会答弁らしい丁寧な口調で。
- 必ず引用元の[参照ID]を明記すること。
"""

        gemini_model = genai.GenerativeModel('gemini-2.5-flash')
        gen_resp = gemini_model.generate_content(prompt)
        
        return {
            "answer": gen_resp.text,
            "references": ranked_documents
        }

    except Exception as e:
        print(f"Error generating answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
