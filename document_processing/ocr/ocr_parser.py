import logging
import pymupdf as fitz  # PyMuPDF
import os

logger = logging.getLogger("product_twin.ocr")

try:
    from PIL import Image
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("PIL or pytesseract not installed. OCR will be disabled or fall back to basic text extraction.")

def ocr_scanned_pdf(pdf_path: str, temp_dir: str = "./temp_ocr") -> list:
    """
    Performs OCR on a PDF that has been flagged as scanned.
    
    Args:
        pdf_path: Path to the PDF file.
        temp_dir: Directory to save page images temporarily.
        
    Returns:
        list: A list of dicts with {"page_number": int, "text": str}
    """
    pages_content = []
    
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir)
        
    doc = fitz.open(pdf_path)
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        page_text = ""
        
        if TESSERACT_AVAILABLE:
            try:
                # Render page to an image (300 DPI for good OCR quality)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                image_path = os.path.join(temp_dir, f"page_{page_num + 1}.png")
                pix.save(image_path)
                
                # Perform OCR using pytesseract
                img = Image.open(image_path)
                page_text = pytesseract.image_to_string(img)
                
                # Clean up temp image
                img.close()
                if os.path.exists(image_path):
                    os.remove(image_path)
            except Exception as e:
                logger.error(f"Error during OCR of page {page_num + 1}: {e}")
                # Fallback to PyMuPDF's default text extraction just in case
                page_text = page.get_text()
        else:
            # Fallback when OCR dependencies are missing
            page_text = page.get_text()
            if not page_text.strip():
                page_text = f"[OCR Required: Page {page_num + 1} appears to be an image/scanned page, but OCR dependencies are missing.]"
        
        pages_content.append({
            "page_number": page_num + 1,
            "text": page_text
        })
        
    doc.close()
    
    # Try to clean up temp dir if empty
    try:
        if os.path.exists(temp_dir) and not os.listdir(temp_dir):
            os.rmdir(temp_dir)
    except Exception:
        pass
        
    return pages_content
