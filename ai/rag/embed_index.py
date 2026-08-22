"""
ai/rag/embed_index.py

Embeds chunks and builds a FAISS index for retrieval.
Uses the new unified google-genai SDK. Batches embedding calls and retries
on rate-limit (429) errors, since each text in a batch counts as one request
against the free-tier quota (100 requests/minute).
"""

import os
import sys
import time
import re
import numpy as np
import faiss

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "extraction"))
from pdf_loader import Chunk


class ChunkIndex:
    def __init__(self, chunks: list[Chunk], use_gemini: bool = True):
        self.chunks = chunks
        self.use_gemini = use_gemini and bool(os.environ.get("GEMINI_API_KEY"))
        self.index = None
        self.embeddings = None

        if self.use_gemini:
            from google import genai
            self._client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
            self._embed_fn = self._embed_gemini
        else:
            print("[embed_index] No GEMINI_API_KEY found — using local sentence-transformers fallback.")
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer("BAAI/bge-small-en-v1.5")
            self._embed_fn = self._embed_local

    def _embed_batch_with_retry(self, batch: list[str], max_retries: int = 5):
        from google.genai import errors as genai_errors
        for attempt in range(max_retries):
            try:
                return self._client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=batch,
                )
            except genai_errors.ClientError as e:
                msg = str(e)
                if "RESOURCE_EXHAUSTED" in msg or "429" in msg:
                    match = re.search(r"retryDelay['\"]?:\s*['\"]?(\d+)", msg)
                    wait = int(match.group(1)) + 2 if match else 20
                    print(f"[embed_index] Rate limited, waiting {wait}s (attempt {attempt+1}/{max_retries}) ...")
                    time.sleep(wait)
                else:
                    raise
        raise RuntimeError("Exceeded max retries on embedding due to rate limits.")

    def _embed_gemini(self, texts: list[str], batch_size: int = 5) -> np.ndarray:
        vectors = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            result = self._embed_batch_with_retry(batch)
            vectors.extend([e.values for e in result.embeddings])
            print(f"[embed_index] Embedded {min(i + batch_size, len(texts))}/{len(texts)} chunks")
            time.sleep(4)
        return np.array(vectors, dtype="float32")

    def _embed_local(self, texts: list[str]) -> np.ndarray:
        return np.array(self._model.encode(texts), dtype="float32")

    def build(self):
        texts = [c.text for c in self.chunks]
        self.embeddings = self._embed_fn(texts)
        dim = self.embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dim)
        self.index.add(self.embeddings)
        print(f"[embed_index] Built FAISS index: {len(self.chunks)} chunks, dim={dim}")

    def search(self, query: str, k: int = 5) -> list[Chunk]:
        query_vec = self._embed_fn([query])
        distances, indices = self.index.search(query_vec, k)
        return [self.chunks[i] for i in indices[0] if i < len(self.chunks)]
