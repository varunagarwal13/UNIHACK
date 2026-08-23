import re

def chunk_text(text: str, max_chars: int = 1000, overlap: int = 200) -> list:
    """Splits text semantically based on paragraphs and sentences, aiming for max_chars."""
    text = text.strip()
    if not text:
        return []

    def split_recursively(t, separators):
        if not separators:
            return [t[i:i + max_chars] for i in range(0, len(t), max_chars - overlap) if t[i:i + max_chars]]

        sep = separators[0]
        # Avoid treating empty separator or lookbehind as typical strings
        if sep == "":
            splits = list(t)
        elif sep == r"(?<=\. )":
            splits = re.split(sep, t)
        else:
            splits = re.split(sep, t)

        good_splits = [s for s in splits if s]
        
        result_chunks = []
        current_chunk = []
        current_len = 0
        
        for s in good_splits:
            if current_len + len(s) > max_chars and current_len > 0:
                # Flush
                join_str = "\n\n" if sep == r'\n\s*\n' else ("\n" if sep == r'\n' else ("" if sep == r"(?<=\. )" or sep == "" else sep))
                result_chunks.append(join_str.join(current_chunk))
                
                # Overlap
                overlap_len = 0
                new_chunk = []
                for item in reversed(current_chunk):
                    if overlap_len + len(item) <= overlap:
                        overlap_len += len(item)
                        new_chunk.insert(0, item)
                    else:
                        break
                current_chunk = new_chunk + [s]
                current_len = sum(len(x) for x in current_chunk)
            else:
                current_chunk.append(s)
                current_len += len(s)
                
        if current_chunk:
            join_str = "\n\n" if sep == r'\n\s*\n' else ("\n" if sep == r'\n' else ("" if sep == r"(?<=\. )" or sep == "" else sep))
            result_chunks.append(join_str.join(current_chunk))
            
        final_result = []
        for r in result_chunks:
            if len(r) > max_chars and len(separators) > 1:
                final_result.extend(split_recursively(r, separators[1:]))
            else:
                final_result.append(r)
                
        return final_result

    return split_recursively(text, [r'\n\s*\n', r'\n', r'(?<=\. )', " ", ""])

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
