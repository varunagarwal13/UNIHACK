"""
ai/extraction/run_extraction.py

End-to-end: PDF -> chunks -> embeddings -> FAISS -> retrieval -> LLM -> structured JSON.
"""

import os
import sys
import json
import re

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "rag"))
from pdf_loader import load_pdf_chunks
from embed_index import ChunkIndex

EXTRACTION_PROMPT = """You are a product-intelligence extraction engine. You will be given
excerpts from a manufacturer datasheet/catalog. Extract the product's key technical
attributes as STRICT JSON matching this exact shape (no markdown, no preamble, no code fences):

{{
  "product_id": "<a representative model/type code from the text>",
  "manufacturer": "<manufacturer name>",
  "category": "<product category>",
  "attributes": {{
    "<attribute_name>": {{
      "value": "<value as string>",
      "unit": "<unit or null>",
      "confidence": <float 0-1>,
      "status": "verified",
      "evidence": [{{"source": "{source_name}", "page": <page number as int>}}]
    }}
  }}
}}

Extract as many distinct attributes as the text supports. Only include attributes
you can find explicit values for. Do not invent values.

--- EXCERPTS ---
{context}
--- END EXCERPTS ---

Return ONLY the JSON object, nothing else.
"""


def build_context(chunks, max_chars=6000):
    context = ""
    for c in chunks:
        piece = f"\n[page {c.page}]\n{c.text}\n"
        if len(context) + len(piece) > max_chars:
            break
        context += piece
    return context


def extract_with_gemini(context: str, source_name: str) -> dict:
    from google import genai
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    prompt = EXTRACTION_PROMPT.format(context=context, source_name=source_name)
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=prompt,
    )
    text = response.text.strip()
    text = re.sub(r"^```json\s*|\s*```$", "", text.strip())
    return json.loads(text)


def main():
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else "sample_data/abb_acs580_catalog.pdf"
    source_name = os.path.basename(pdf_path)

    print(f"[run_extraction] Loading + chunking {pdf_path} ...")
    chunks = load_pdf_chunks(pdf_path)
    print(f"[run_extraction] {len(chunks)} chunks created.")

    print("[run_extraction] Building embedding index ...")
    index = ChunkIndex(chunks)
    index.build()

    query = "voltage current power rating weight dimensions IP rating technical data"
    top_chunks = index.search(query, k=8)
    context = build_context(top_chunks)

    if not os.environ.get("GEMINI_API_KEY"):
        print("\n[run_extraction] GEMINI_API_KEY not set — printing context only, skipping LLM call.")
        print(context[:1000])
        return

    print("[run_extraction] Calling Gemini for structured extraction ...")
    result = extract_with_gemini(context, source_name)

    out_path = "sample_data/extracted_product.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"[run_extraction] Done. Wrote {out_path}")
    print(json.dumps(result, indent=2)[:1000])


if __name__ == "__main__":
    main()