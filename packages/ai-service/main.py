from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

app = FastAPI(title="VoiceSell AI Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health ---
@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}


# --- STT ---
from stt import transcribe_audio

@app.post("/stt")
async def stt_endpoint(audio: UploadFile = File(...)):
    """Transcribe audio to text with language detection."""
    audio_bytes = await audio.read()
    result = await transcribe_audio(audio_bytes)
    return result


# --- Vector Search ---
from vector_store import search_products

class SearchRequest(BaseModel):
    query: str
    merchant_id: str
    top_k: int = 3

@app.post("/search")
async def search_endpoint(req: SearchRequest):
    """Search products by semantic similarity."""
    results = await search_products(req.query, req.merchant_id, req.top_k)
    return {"results": results}


# --- Embeddings ---
from embeddings import embed_products

class EmbedRequest(BaseModel):
    merchant_id: str
    products: list[dict]

@app.post("/embed")
async def embed_endpoint(req: EmbedRequest):
    """Embed products into vector store."""
    count = await embed_products(req.merchant_id, req.products)
    return {"embedded": count}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
