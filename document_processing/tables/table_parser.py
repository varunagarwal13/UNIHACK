import pdfplumber

def extract_tables_from_pdf(pdf_path: str) -> list:
    """
    Extracts structured tables page-by-page from a PDF file using pdfplumber.
    
    Returns:
        list: A list of dicts:
            [
                {
                    "page_number": int,
                    "tables": [
                        [ [cell, cell, ...], [cell, cell, ...] ] # A single table (list of rows)
                    ]
                }
            ]
    """
    tables_content = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            extracted_tables = page.extract_tables()
            if not extracted_tables:
                continue
                
            cleaned_tables = []
            for table in extracted_tables:
                cleaned_table = []
                for row in table:
                    # Clean cell values (None -> empty string, strip whitespace)
                    cleaned_row = [str(cell).strip() if cell is not None else "" for cell in row]
                    # Only add rows that aren't completely empty
                    if any(cleaned_row):
                        cleaned_table.append(cleaned_row)
                if cleaned_table:
                    cleaned_tables.append(cleaned_table)
            
            if cleaned_tables:
                tables_content.append({
                    "page_number": page_num + 1,
                    "tables": cleaned_tables
                })
                
    return tables_content
