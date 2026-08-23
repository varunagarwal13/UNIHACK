import os
import logging
from sqlalchemy.orm import Session
from database.models import Product, Source, Attribute, Evidence, Conflict
from document_processing.pdf.pdf_parser import extract_text_from_pdf
from document_processing.tables.table_parser import extract_tables_from_pdf
from document_processing.images.image_processor import extract_images_from_pdf
from document_processing.web.source_ingestion import fetch_webpage_content
from document_processing.chunker import process_document_to_chunks

logger = logging.getLogger("product_twin.orchestrator")

# Interface Stub for Person 1: AI / RAG Engineer
class AIExtractor:
    """
    Mock AI Extractor representing Person 1's extraction logic.
    Analyzes document chunks using keyword detection to mock realistic extraction.
    """
    def extract(self, chunks: list) -> dict:
        import sys
        import os
        ai_dir = os.path.join(os.path.dirname(__file__), "..", "ai")
        # Ensure AI paths are resolvable
        if os.path.join(ai_dir, "rag") not in sys.path:
            sys.path.append(os.path.join(ai_dir, "rag"))
            sys.path.append(os.path.join(ai_dir, "extraction"))
            
        try:
            from embed_index import ChunkIndex
            from run_extraction import build_context_with_images, extract_with_gemini
            
            # 1. Build and search FAISS Index
            index = ChunkIndex(chunks)
            index.build()
            
            query = "voltage current power rating weight dimensions IP rating technical data"
            top_chunks = index.search(query, k=8)
            context, images = build_context_with_images(top_chunks)
            
            # Grab source name from chunks if available
            source_name = chunks[0].get("source", "document") if chunks and isinstance(chunks[0], dict) else "document"
            
            # 2. Extract explicitly using LLM
            return extract_with_gemini(context, images, source_name)
        except Exception as e:
            logger.error(f"AI Extraction pipeline failed ({str(e)}). Ensure GEMINI_API_KEY is set. Returning fallback mock.")
            return self._mock_extract(chunks)

    def _mock_extract(self, chunks: list) -> dict:
        is_abb = False
        for chunk in chunks:
            content = chunk.get("content", "").upper()
            if "ACS580" in content or "ABB" in content:
                is_abb = True
                break
                
        if is_abb:
            return {
                "product_id": "ACS580-01-046A-4",
                "manufacturer": "ABB",
                "category": "Variable Frequency Drive",
                "attributes": {
                    "voltage": {"value": "380-480", "unit": "V", "page": 1, "snippet": "Input voltage: 380-480 V AC"},
                    "current": {"value": "46", "unit": "A", "page": 1, "snippet": "Nominal current: 46 A"},
                    "power": {"value": "22", "unit": "kW", "page": 1, "snippet": "Nominal power: 22 kW"},
                    "ip_rating": {"value": "IP21", "unit": None, "page": 14, "snippet": "Enclosure rating: IP21 standard protection"},
                    "weight": {"value": "18.2", "unit": "kg", "page": 8, "snippet": "Product weight: 18.2 kg"}
                }
            }
        else:
            return {
                "product_id": "GENERIC-SKU-100",
                "manufacturer": "Generic Corp",
                "category": "Industrial Equipment",
                "attributes": {
                    "voltage": {"value": "230", "unit": "V", "page": 1, "snippet": "Voltage rating is 230V"},
                    "weight": {"value": "12.5", "unit": "kg", "page": 2, "snippet": "Net weight: 12.5 kg"}
                }
            }


# Interface Stub & Adapter for Person 2: Trust & Validation Engineer
class Validator:
    """
    Validator adapter class. Connects FastAPI pipeline to Person 2's validation
    logic in `validation/pipeline.py` when running live. Otherwise, runs local stubs.
    """
    def __init__(self, use_real_pipeline: bool = False):
        self.use_real_pipeline = use_real_pipeline

    def validate(self, extracted_data: dict, existing_attributes: list, source_name: str) -> dict:
        if self.use_real_pipeline:
            # 1. Gather all readings (new + existing database values)
            attribute_readings = {}
            
            # Current extraction reading
            for attr_name, attr_info in extracted_data["attributes"].items():
                if attr_name not in attribute_readings:
                    attribute_readings[attr_name] = []
                attribute_readings[attr_name].append({
                    "value": attr_info["value"],
                    "source": source_name
                })
                
            # Historical readings from other sources in DB
            for db_attr in existing_attributes:
                if db_attr.name not in attribute_readings:
                    attribute_readings[db_attr.name] = []
                for ev in db_attr.evidence:
                    attribute_readings[db_attr.name].append({
                        "value": db_attr.value,
                        "source": ev.source
                    })
                if not db_attr.evidence:
                    attribute_readings[db_attr.name].append({
                        "value": db_attr.value,
                        "source": "Existing Database Record"
                    })
                    
            # 2. Invoke Person 2's validation pipeline
            from validation.pipeline import validate_product
            res = validate_product(extracted_data["product_id"], attribute_readings)
            
            # 3. Map validation schemas back to database expected formats
            attributes = {}
            for attr_name, attr_data in res["attributes"].items():
                # Recover unit from inputs
                unit = None
                if attr_name in extracted_data["attributes"]:
                    unit = extracted_data["attributes"][attr_name].get("unit")
                if not unit:
                    for db_attr in existing_attributes:
                        if db_attr.name == attr_name:
                            unit = db_attr.unit
                            break
                            
                evidence_list = []
                for ev in attr_data.get("evidence", []):
                    # Recover text snippet/content
                    content = None
                    if ev["source"] == source_name and attr_name in extracted_data["attributes"]:
                        content = extracted_data["attributes"][attr_name].get("snippet")
                    else:
                        for db_attr in existing_attributes:
                            if db_attr.name == attr_name:
                                for db_ev in db_attr.evidence:
                                    if db_ev.source == ev["source"]:
                                        content = db_ev.content
                                        break
                    evidence_list.append({
                        "source": ev["source"],
                        "page": ev.get("page"),
                        "content": content or ev.get("raw_value")
                    })
                    
                attributes[attr_name] = {
                    "value": str(attr_data["value"]),
                    "unit": unit,
                    "confidence": attr_data["confidence"],
                    "status": "verified" if attr_data["status"] == "verified" or attr_data["status"] == "auto_approved" else "flagged",
                    "evidence": evidence_list
                }
                
            conflicts = []
            for c in res["conflicts"]:
                vals = c.get("values", [])
                s1 = vals[0]["source"] if len(vals) > 0 else "Source 1"
                v1 = str(vals[0]["value"]) if len(vals) > 0 else ""
                s2 = vals[1]["source"] if len(vals) > 1 else "Source 2"
                v2 = str(vals[1]["value"]) if len(vals) > 1 else ""
                
                conflicts.append({
                    "attribute_name": c["attribute"],
                    "source_1": s1,
                    "value_1": v1,
                    "source_2": s2,
                    "value_2": v2,
                    "description": c.get("reasoning") or "Value mismatch detected.",
                    "status": "pending" if c["status"] == "human_review" else "resolved"
                })
                
            return {
                "attributes": attributes,
                "conflicts": conflicts,
                "review_required": res["review_required"]
            }
            
        # Development fallback (Stubs)
        product_id = extracted_data["product_id"]
        attributes = {}
        conflicts = []
        review_required = False
        
        for attr_name, attr_info in extracted_data["attributes"].items():
            value = attr_info["value"]
            unit = attr_info["unit"]
            page = attr_info.get("page")
            snippet = attr_info.get("snippet", "")
            
            conflict_detected = False
            for existing in existing_attributes:
                if existing.name == attr_name and existing.value != value:
                    conflict_detected = True
                    review_required = True
                    conflicts.append({
                        "attribute_name": attr_name,
                        "source_1": "Manufacturer Datasheet",
                        "value_1": existing.value,
                        "source_2": source_name,
                        "value_2": value,
                        "description": f"Value mismatch for '{attr_name}'. Primary source has '{existing.value} {existing.unit or ''}', secondary source has '{value} {unit or ''}'."
                    })
                    break
            
            confidence = 0.95 if not conflict_detected else 0.71
            status = "flagged" if conflict_detected else "verified"
            
            attributes[attr_name] = {
                "value": value,
                "unit": unit,
                "confidence": confidence,
                "status": status,
                "evidence": [
                    {
                        "source": source_name,
                        "page": page,
                        "content": snippet
                    }
                ]
            }
            
        return {
            "attributes": attributes,
            "conflicts": conflicts,
            "review_required": review_required
        }


class PipelineOrchestrator:
    def __init__(self):
        # By default, use stubs for hackathon scaffolding. Set REAL_PIPELINE=true in environment or configure Person 1/2 classes to use actual logic.
        self.use_real_pipeline = os.getenv("REAL_PIPELINE", "false").lower() == "true"
        self.ai_extractor = AIExtractor()
        self.validator = Validator(use_real_pipeline=self.use_real_pipeline)

    def ingest_and_parse_document(self, db: Session, file_path: str, filename: str, product_id: str = None) -> list:
        """
        Parses document text, tables, and images, and generates chunks.
        Saves document details as a Source record in the DB.
        """
        # 1. Parse text, tables, images
        doc_data = extract_text_from_pdf(file_path)
        tables_data = extract_tables_from_pdf(file_path)
        
        # Save images in uploads/extracted_images folder
        img_output_dir = os.path.join(os.path.dirname(file_path), "extracted_images")
        images_data = extract_images_from_pdf(file_path, output_dir=img_output_dir)
        
        doc_data["tables"] = tables_data
        doc_data["images"] = images_data
        
        # Generate chunks (Hour 8 Deliverable boundary)
        chunks = process_document_to_chunks(doc_data, filename)
        
        # Create product stub if not exists
        if not product_id:
            # Try to infer SKU from filename or fallback
            product_id = "ACS580-01-046A-4" if "ACS580" in filename.upper() else "GENERIC-SKU-100"
            
        db_product = db.query(Product).filter(Product.id == product_id).first()
        if not db_product:
            db_product = Product(id=product_id, review_required=False)
            db.add(db_product)
            db.commit()
            db.refresh(db_product)

        # Save Source to database
        db_source = Source(
            product_id=product_id,
            source_type="pdf",
            name=filename,
            file_path=file_path,
            trust_score=1.0,
            status="processed"
        )
        db.add(db_source)
        db.commit()
        
        return chunks

    def ingest_url(self, db: Session, url: str, product_id: str) -> list:
        """Ingests raw text from a website, converts to chunks, and saves URL Source."""
        web_data = fetch_webpage_content(url)
        if web_data.get("error"):
            logger.error(f"Error fetching url {url}: {web_data.get('text')}")
            return []
            
        # Formulate into chunk structure
        chunk_content = f"Source URL: {url}\nTitle: {web_data['title']}\nDescription: {web_data['metadata'].get('description', '')}\n\nContent:\n{web_data['text']}"
        chunks = [{
            "source": url,
            "page": None,
            "type": "text",
            "content": chunk_content
        }]
        
        # Save URL as Source record
        db_source = Source(
            product_id=product_id,
            source_type="web",
            name=web_data["title"] or url,
            url=url,
            trust_score=0.9,  # Default trust score for web sources (e.g. distributor web pages)
            status="processed"
        )
        db.add(db_source)
        db.commit()
        
        return chunks

    def run_analysis(self, db: Session, product_id: str, chunks: list, source_name: str) -> Product:
        """
        Runs the AI extraction and Validation stages on the chunks,
        persists the attributes, evidence, and conflicts to the DB.
        """
        # Fetch product record
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            product = Product(id=product_id)
            db.add(product)
            db.commit()
            db.refresh(product)
            
        # Get existing attributes for conflict detection
        existing_attributes = db.query(Attribute).filter(Attribute.product_id == product_id).all()
        
        # 1. AI Extraction (Person 1)
        extracted_data = self.ai_extractor.extract(chunks)
        
        # Override product ID if AI detected a specific SKU
        if extracted_data.get("product_id") and extracted_data["product_id"] != product_id:
            product_id = extracted_data["product_id"]
            
        # Update manufacturer and category from AI extraction
        if extracted_data.get("manufacturer"):
            product.manufacturer = extracted_data["manufacturer"]
        if extracted_data.get("category"):
            product.category = extracted_data["category"]
        db.commit()
            
        # 2. Validation & Conflict scoring (Person 2)
        validation_results = self.validator.validate(extracted_data, existing_attributes, source_name)
        
        # Save Validation Results to DB
        product.review_required = validation_results["review_required"]
        
        for attr_name, attr_data in validation_results["attributes"].items():
            # Check if attribute already exists
            db_attr = db.query(Attribute).filter(
                Attribute.product_id == product_id,
                Attribute.name == attr_name
            ).first()
            
            if db_attr:
                # If verified state, update values. If flagged, keep original but log conflict.
                if attr_data["status"] == "verified":
                    db_attr.value = attr_data["value"]
                    db_attr.unit = attr_data["unit"]
                    db_attr.confidence = attr_data["confidence"]
                    db_attr.status = attr_data["status"]
            else:
                db_attr = Attribute(
                    product_id=product_id,
                    name=attr_name,
                    value=attr_data["value"],
                    unit=attr_data["unit"],
                    confidence=attr_data["confidence"],
                    status=attr_data["status"]
                )
                db.add(db_attr)
                db.commit()
                db.refresh(db_attr)
                
            # Save Evidence
            for ev_data in attr_data["evidence"]:
                db_evidence = Evidence(
                    attribute_id=db_attr.id,
                    source=ev_data["source"],
                    page=ev_data["page"],
                    content=ev_data["content"]
                )
                db.add(db_evidence)
                
        # Save Conflicts
        for conf_data in validation_results["conflicts"]:
            # Check if this conflict is already logged
            exists = db.query(Conflict).filter(
                Conflict.product_id == product_id,
                Conflict.attribute_name == conf_data["attribute_name"],
                Conflict.value_2 == conf_data["value_2"]
            ).first()
            
            if not exists:
                db_conflict = Conflict(
                    product_id=product_id,
                    attribute_name=conf_data["attribute_name"],
                    source_1=conf_data["source_1"],
                    value_1=conf_data["value_1"],
                    source_2=conf_data["source_2"],
                    value_2=conf_data["value_2"],
                    description=conf_data["description"],
                    status="pending"
                )
                db.add(db_conflict)
                
        db.commit()
        db.refresh(product)
        return product
