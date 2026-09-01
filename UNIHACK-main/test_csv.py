import os
import sys
import csv
import json

sys.path.append(os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.database import Base
from backend.pipeline_orchestrator import PipelineOrchestrator

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def verify_csv_integration():
    db = SessionLocal()
    orchestrator = PipelineOrchestrator()
    csv_path = "tests/Unihack_ Sample Dataset - Input.csv"
    
    if not os.path.exists(csv_path):
        print(f"FAILED: Cannot find {csv_path}")
        return

    print("--- [CSV INGESTION] Testing AI Orchestrator on Sample Dataset (Top 3 SKUs) ---")
    if not os.environ.get("GEMINI_API_KEY"):
         print("⚠️ WARNING: GEMINI_API_KEY is not set. Data will default to fallback mocks.")

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            if count >= 3:
                break
            part_num = row.get("Mfg_Part_Num", f"TEST-{count}")
            desc = row.get("Part_Desc", "")
            
            print(f"\n=============================================")
            print(f">>> Processing SKU: {part_num}")
            print(f">>> Input Data: {desc}")
            print(f"=============================================")
            
            # Mock the document chunking process by injecting the description directly
            # The RAG and MMR code natively supports these dictionaries!
            chunks = [{"page": 1, "text": desc, "source": "CSV Input"}]
            
            try:
                product_record = orchestrator.run_analysis(
                    db=db,
                    product_id=part_num,
                    chunks=chunks,
                    source_name="CSV Input"
                )
                
                print(f"✅ Product Record saved successfully: {product_record.id}")
                print("Extracted Attributes:")
                for attr in product_record.attributes:
                    print(f"  - {attr.name}: {attr.value} {attr.unit or ''}")
            except Exception as e:
                print(f"❌ Failed to process {part_num}: {str(e)}")
                
            count += 1
            import time
            time.sleep(2) # Avoid aggressive rate limits 
            
if __name__ == "__main__":
    verify_csv_integration()
