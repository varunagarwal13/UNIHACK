import os
import fitz  # PyMuPDF

def extract_images_from_pdf(pdf_path: str, output_dir: str = "./extracted_images") -> list:
    """
    Extracts embedded images page-by-page from a PDF file.
    Saves them to output_dir and returns their paths and metadata.
    
    Args:
        pdf_path: Path to the PDF file.
        output_dir: Directory where images will be saved.
        
    Returns:
        list: A list of dicts:
            [
                {
                    "page_number": int,
                    "image_index": int,
                    "file_path": str,
                    "extension": str,
                    "width": int,
                    "height": int
                }
            ]
    """
    extracted_images = []
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    doc = fitz.open(pdf_path)
    
    for page_num in range(len(doc)):
        image_list = doc.get_images(page_num)
        
        for img_idx, img_info in enumerate(image_list):
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                width = base_image["width"]
                height = base_image["height"]
                
                # Construct output file name
                filename = f"extracted_img_p{page_num + 1}_{img_idx + 1}.{image_ext}"
                file_path = os.path.join(output_dir, filename)
                
                # Save the image
                with open(file_path, "wb") as f:
                    f.write(image_bytes)
                    
                extracted_images.append({
                    "page_number": page_num + 1,
                    "image_index": img_idx + 1,
                    "file_path": os.path.abspath(file_path),
                    "extension": image_ext,
                    "width": width,
                    "height": height
                })
            except Exception as e:
                # Log error or continue
                pass
                
    doc.close()
    return extracted_images
