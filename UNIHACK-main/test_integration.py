import os
import sys

# Ensure backend can import modular components natively
sys.path.append(os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.database import Base
from backend.pipeline_orchestrator import PipelineOrchestrator

# Setup a temporary in-memory sqlite database for the test
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def verify_pipeline_integration():
    db = SessionLocal()
    # Force the PipelineOrchestrator to know we want real logic if needed
    os.environ["REAL_PIPELINE"] = "true" 
    orchestrator = PipelineOrchestrator()
    pdf_path = "sample_data/abb_acs580_catalog.pdf"
    
    # Check if sample exists
    if not os.path.exists(pdf_path):
        print(f"FAILED: Cannot find {pdf_path}")
        return

    print("--- [STAGE 1] Document Ingestion & Semantic Chunking ---")
    chunks = orchestrator.ingest_and_parse_document(
        db=db, 
        file_path=pdf_path, 
        filename="abb_acs580_catalog.pdf", 
        product_id="TEST-ACS580-001"
    )
    print(f"✅ Generated {len(chunks)} multimodal semantic chunks from document.")

    print("\n--- [STAGE 2] AI Extraction (Person 1) & Validation (Person 2) ---")
    if not os.environ.get("GEMINI_API_KEY"):
         print("⚠️ WARNING: GEMINI_API_KEY is not set. FAISS will correctly use local SentenceTransformers (BGE-Small) and LLM will hit the fallback check.")
    
    # This triggers the AIExtractor we just integrated!
    product_record = orchestrator.run_analysis(
        db=db,
        product_id="TEST-ACS580-001",
        chunks=chunks,
        source_name="abb_acs580_catalog.pdf"
    )
    
    print(f"\n✅ Product Record saved successfully: {product_record.id}")
    print(f"✅ Verification flag: {product_record.review_required}")
    print("\nAttributes Extracted and persisted to DB:")
    for attr in product_record.attributes:
        print(f"  - {attr.name}: {attr.value} {attr.unit or ''} (Confidence: {attr.confidence})")

if __name__ == "__main__":
    verify_pipeline_integration()
