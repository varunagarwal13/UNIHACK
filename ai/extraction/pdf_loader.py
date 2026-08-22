"""
ai/extraction/pdf_loader.py

Loads a PDF and splits it into overlapping text chunks with page numbers attached.
This is a LOCAL STAND-IN for Person 3's real parsed chunks until the Hour 8 handoff.
"""

import pymupdf as fitz
from dataclasses import dataclass


@dataclass
class Chunk:
    text: str
    page: int
    chunk_id: str


def load_pdf_chunks(pdf_path: str, chunk_size: int = 800, overlap: int = 150) -> list[Chunk]:
    doc = fitz.open(pdf_path)
    chunks: list[Chunk] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").strip()
        if not text:
            continue

        start = 0
        idx = 0
        while start < len(text):
            end = start + chunk_size
            piece = text[start:end]
            chunks.append(
                Chunk(text=piece, page=page_num + 1, chunk_id=f"p{page_num + 1}_c{idx}")
            )
            start = end - overlap
            idx += 1

    doc.close()
    return chunks


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "sample_data/abb_acs580_catalog.pdf"
    chunks = load_pdf_chunks(path)
    print(f"Loaded {len(chunks)} chunks from {path}")
    print("--- Sample chunk ---")
    print(chunks[0])