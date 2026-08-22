def chunk_text(text: str, max_chars: int = 1000, overlap: int = 200) -> list:
    """Splits a single block of text into overlapping character chunks."""
    chunks = []
    text = text.strip()
    if not text:
        return chunks
        
    start = 0
    while start < len(text):
        end = start + max_chars
        chunk = text[start:end]
        chunks.append(chunk)
        start += (max_chars - overlap)
        
    return chunks

def format_table_as_markdown(table: list) -> str:
    """Converts a table (list of lists) into a markdown string representation."""
    if not table:
        return ""
        
    markdown_lines = []
    # Header row
    headers = table[0]
    markdown_lines.append("| " + " | ".join(headers) + " |")
    # Separator row
    markdown_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
    # Data rows
    for row in table[1:]:
        # Ensure row has same length as header
        if len(row) < len(headers):
            row = row + [""] * (len(headers) - len(row))
        elif len(row) > len(headers):
            row = row[:len(headers)]
        markdown_lines.append("| " + " | ".join(row) + " |")
        
    return "\n".join(markdown_lines)

def process_document_to_chunks(document_data: dict, source_name: str) -> list:
    """
    Processes extracted text, tables, and images from a document into structured chunks.
    
    Args:
        document_data: dict containing keys like 'pages', 'tables', 'images'
        source_name: Name of the file/source (e.g. 'datasheet.pdf')
        
    Returns:
        list: Chunks list where each chunk is a dict:
            {
                "source": str,
                "page": int or None,
                "type": str ("text" | "table" | "image"),
                "content": str
            }
    """
    chunks = []
    
    # 1. Process Text pages
    pages = document_data.get("pages", [])
    for page in pages:
        page_num = page.get("page_number")
        text = page.get("text", "")
        text_chunks = chunk_text(text)
        for t_chunk in text_chunks:
            chunks.append({
                "source": source_name,
                "page": page_num,
                "type": "text",
                "content": t_chunk
            })
            
    # 2. Process Tables
    tables = document_data.get("tables", [])
    for page_tables in tables:
        page_num = page_tables.get("page_number")
        for table in page_tables.get("tables", []):
            table_md = format_table_as_markdown(table)
            if table_md:
                chunks.append({
                    "source": source_name,
                    "page": page_num,
                    "type": "table",
                    "content": table_md
                })
                
    # 3. Process Images
    images = document_data.get("images", [])
    for img in images:
        page_num = img.get("page_number")
        file_path = img.get("file_path")
        # For RAG context, we tell the LLM that an image exists at this path
        chunks.append({
            "source": source_name,
            "page": page_num,
            "type": "image",
            "content": f"[Embedded Product Image: {os.path.basename(file_path)} path={file_path}]"
        })
        
    return chunks

import os
