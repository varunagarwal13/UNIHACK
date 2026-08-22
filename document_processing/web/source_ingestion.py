import requests
from bs4 import BeautifulSoup
import re

def fetch_webpage_content(url: str) -> dict:
    """
    Fetches a webpage, cleans the HTML content, and extracts relevant text and metadata.
    
    Args:
        url: The URL to scrape.
        
    Returns:
        dict: A dictionary containing:
            - "title": Title of the page
            - "metadata": Scraped page meta tags
            - "text": Cleaned extracted text content
            - "url": Original URL
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        return {
            "title": "Error Fetching URL",
            "metadata": {},
            "text": f"Failed to retrieve content from {url}. Error: {str(e)}",
            "url": url,
            "error": True
        }
        
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Remove script and style elements
    for script_or_style in soup(["script", "style", "nav", "footer", "header", "aside"]):
        script_or_style.decompose()
        
    # Get title
    title = soup.title.string.strip() if soup.title else ""
    
    # Get meta description
    meta_desc = ""
    desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
    if desc_tag and desc_tag.get("content"):
        meta_desc = desc_tag.get("content").strip()
        
    # Extract plain text content
    text_blocks = []
    
    # Find all headings, paragraphs, and list items
    for element in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "tr"]):
        text = element.get_text().strip()
        if text:
            # Add prefix for headers to keep structure in chunks
            if element.name.startswith("h"):
                text_blocks.append(f"\n{text}\n" + "=" * len(text))
            elif element.name == "tr":
                # Convert table rows to a pseudo-CSV line
                cells = [c.get_text().strip() for c in element.find_all(["td", "th"])]
                if any(cells):
                    text_blocks.append(" | ".join(cells))
            else:
                text_blocks.append(text)
                
    cleaned_text = "\n".join(text_blocks)
    # Deduplicate multiple newlines
    cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
    
    return {
        "title": title,
        "metadata": {
            "description": meta_desc,
            "status_code": response.status_code
        },
        "text": cleaned_text,
        "url": url,
        "error": False
    }
