import pymupdf as fitz  # PyMuPDF

def extract_text_from_pdf(pdf_path: str) -> dict:
    """
    Extracts text page-by-page from a PDF file.
    
    Returns:
        dict: A dictionary containing:
            - "metadata": dict of file metadata
            - "pages": list of dicts with {"page_number": int, "text": str}
            - "is_scanned": bool, True if very little text was extracted (threshold-based)
    """
    doc = fitz.open(pdf_path)
    pages_content = []
    total_text_length = 0
    
    # Harvest metadata
    metadata = {
        "title": doc.metadata.get("title", ""),
        "author": doc.metadata.get("author", ""),
        "subject": doc.metadata.get("subject", ""),
        "keywords": doc.metadata.get("keywords", ""),
        "creator": doc.metadata.get("creator", ""),
        "producer": doc.metadata.get("producer", ""),
        "page_count": len(doc)
    }

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text()
        total_text_length += len(text.strip())
        pages_content.append({
            "page_number": page_num + 1,
            "text": text
        })
    
    doc.close()
    
    # If the average text length per page is extremely low, it's likely a scanned PDF
    is_scanned = len(pages_content) > 0 and (total_text_length / len(pages_content)) < 50

    return {
        "metadata": metadata,
        "pages": pages_content,
        "is_scanned": is_scanned
    }
