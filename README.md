# ProductTwin Backend (Person 3 - Backend & Document Engineer)

This is the backend and document ingestion system for **ProductTwin**, implemented as part of the 48-Hour Hackathon Execution Plan.

It handles PDF text and table parsing, image extraction, web url scraping, semantic chunking with metadata trail, SQL database persistence (PostgreSQL/SQLite), conflict management, and exposes the REST APIs for the judges' dashboard.

## Folder Structure

```text
product-twin/
│
├── backend/
│   ├── main.py                     # FastAPI application endpoints
│   ├── schemas.py                  # Pydantic schemas (Shared Data Contract)
│   └── pipeline_orchestrator.py    # Glue connecting parsing, extraction, & validation
│
├── database/
│   ├── database.py                 # SQLAlchemy DB setup (SQLite/PostgreSQL)
│   └── models.py                   # ProductTwin DB schema (Product, Attributes, etc.)
│
├── document_processing/
│   ├── chunker.py                  # Page-referenced layout/text chunker
│   ├── pdf/
│   │   └── pdf_parser.py           # PyMuPDF text & metadata parser
│   ├── tables/
│   │   └── table_parser.py         # pdfplumber tabular data extractor
│   ├── ocr/
│   │   └── ocr_parser.py           # pytesseract scanned pages OCR converter
│   ├── images/
│   │   └── image_processor.py      # PyMuPDF image extractor
│   └── web/
│       └── source_ingestion.py     # BeautifulSoup web text fetcher
│
├── tests/
│   └── test_backend.py             # Database and parser test suites
│
├── uploads/                        # Temporary PDF storage
├── requirements.txt                # Python dependencies
└── README.md
```

## Setup & Ingress Instructions

### 1. Set up Virtual Environment
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows, use `.venv\Scripts\activate`
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Automated Tests
```bash
python -m unittest tests/test_backend.py
```

### 4. Start the Application
Start the FastAPI server:
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Once running, navigate to `http://localhost:8000/docs` (or the Codespaces forwarded port) to access the interactive Swagger API documentation.

---

## API Documentation

### Ingestion Endpoints
*   `POST /document/upload`: Uploads a PDF datasheet. Parses pages for text, structured tables, and embedded images. Returns page-referenced JSON chunks (**Hour-8 Handoff boundary**).
*   `POST /product/analyze`: Accepts a `product_id` (SKU) and run-trigger. Scraping target webpage (if URL supplied) or executing Person 1's AI extraction and Person 2's validation on uploaded chunks. Persists results to the database.

### Retrieval & Human Review Endpoints
*   `GET /product/{id}`: Returns the complete product twin record matching the **Shared Data Contract** format.
*   `GET /product/{id}/evidence`: Returns the list of evidence citations supporting attributes.
*   `GET /product/{id}/conflicts`: Returns the list of detected conflicts.
*   `POST /review/{id}`: Accept human overrides to verify values, resolve active conflicts, and clear warnings.
*   `GET /product/{id}/export`: Exports verified product attributes to CSV or JSON formats.
