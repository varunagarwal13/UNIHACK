"""
ai/extraction/run_extraction.py

End-to-end: PDF -> chunks -> embeddings -> FAISS -> retrieval -> LLM -> structured JSON.
"""

import os
import sys
import json
import re

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "rag"))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "schemas"))
from pdf_loader import load_pdf_chunks
from embed_index import ChunkIndex
from product_schema import ProductRecord

EXTRACTION_PROMPT = """You are an advanced multi-modal product-intelligence extraction engine. 
You will be given excerpts from a manufacturer datasheet/catalog, as well as embedded images and technical diagrams. 

CRITICAL INSTRUCTIONS FOR IMAGES:
If visual schematics, dimension diagrams, CAD drawings, or tables are provided in your context payload, you must rigorously analyze them visually. Extract explicit technical parameters (such as dimensions, visual wiring pinouts, form factors, etc.) natively from the illustrations that might not exist in the raw OCR text.

Extract the product's key technical attributes as STRICT JSON matching this exact shape (no markdown, no preamble, no code fences):

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


def build_context_with_images(chunks, max_chars=6000):
    context = ""
    images = []
    import os
    
    for c in chunks:
        if isinstance(c, dict):
            page_num = c.get("page", "unknown")
            text = c.get("content", c.get("text", ""))
        else:
            page_num = getattr(c, "page", "unknown")
            text = getattr(c, "text", "")
            
        # Detect if chunk is an embedded image chunk
        img_match = re.search(r"path=(.*?)]", text)
        if img_match and "Embedded Product Image" in text:
            img_path = img_match.group(1)
            if os.path.exists(img_path):
                from PIL import Image
                images.append(Image.open(img_path))
            continue
            
        piece = f"\n[page {page_num}]\n{text}\n"
        if len(context) + len(piece) > max_chars:
            break
        context += piece
    return context, images


def extract_with_gemini(context: str, images: list, source_name: str) -> dict:
    from google import genai
    import json
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    prompt = EXTRACTION_PROMPT.format(context=context, source_name=source_name)
    
    contents = [prompt] + images
    
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=contents,
    )
    text = response.text.strip()
    text = re.sub(r"^```json\s*|\s*```$", "", text.strip())
    try:
        data = ProductRecord.model_validate_json(text).model_dump()
        return data
    except Exception as e:
        print(f"[extract_with_gemini] Pydantic validation failed: {str(e)}")
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
    context, images = build_context_with_images(top_chunks)

    if not os.environ.get("GEMINI_API_KEY"):
        print("\n[run_extraction] GEMINI_API_KEY not set — printing context only, skipping LLM call.")
        print(context[:1000])
        return

    print("[run_extraction] Calling Gemini for structured extraction ...")
    result = extract_with_gemini(context, images, source_name)

    out_path = "sample_data/extracted_product.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"[run_extraction] Done. Wrote {out_path}")
    print(json.dumps(result, indent=2)[:1000])


if __name__ == "__main__":
    main()