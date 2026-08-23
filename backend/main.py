import os
import shutil
import csv
from io import StringIO
from typing import Optional
from fastapi import FastAPI, Depends, File, UploadFile, HTTPException, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session

from database.database import engine, get_db, Base
from database.models import Product, Source, Attribute, Evidence, Conflict
from backend.schemas import ProductResponse, ReviewRequest, AttributeValueSchema, EvidenceSchema, ConflictSchema
from backend.pipeline_orchestrator import PipelineOrchestrator
from ai.graph.knowledge_graph import build_knowledge_graph

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ProductTwin Backend API",
    description="Backend API and pipeline orchestration for ProductTwin product-intelligence pipeline.",
    version="1.0.0"
)

# Enable CORS for frontend integration (Next.js)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

import tempfile
UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

orchestrator = PipelineOrchestrator()


@app.post("/document/upload", summary="Upload a datasheet and get text/table RAG chunks")
async def upload_document(
    product_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Uploads a PDF datasheet, saves it locally, parses its content page-by-page 
    (text, tables, images), and returns page-referenced chunks (Hour-8 Deliverable).
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    try:
        # Ingest and parse document
        chunks = orchestrator.ingest_and_parse_document(db, file_path, file.filename, product_id)
        return {
            "message": "Document uploaded and parsed successfully",
            "filename": file.filename,
            "file_path": os.path.abspath(file_path),
            "chunks_count": len(chunks),
            "chunks": chunks
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing error: {str(e)}")


@app.post("/document/upload_and_analyze")
async def upload_and_analyze(
    product_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Serverless-compatible atomic route that uploads the file and analyzes it in a single execution.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_location, "wb+") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    try:
        review_required = orchestrator.run_pipeline(
            product_id=product_id,
            source=file.filename,
            source_type="pdf",
            db=db,
            url=None
        )
        return {"message": "Upload and analysis completed successfully", "product_id": product_id, "review_required": review_required}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/product/analyze", summary="Run pipeline analysis on chunks and save twin attributes")
async def analyze_product(
    product_id: str,
    source_name: str,
    url: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Triggers the AI extraction (Person 1) and Validation/Conflict scoring (Person 2) 
    pipeline on the uploaded document's chunks, or scrapes a URL if provided.
    Saves results to PostgreSQL/SQLite database.
    """
    chunks = []
    
    # If URL is provided, scrape it and create chunks
    if url:
        if not url.startswith("http"):
            # Treat plain strings as direct SKU lookups 
            chunks = [{
                "source": "Direct SKU Input",
                "page": None,
                "type": "text",
                "content": f"User provided SKU: {url}"
            }]
        else:
            chunks = orchestrator.ingest_url(db, url, product_id)
            if not chunks:
                raise HTTPException(status_code=400, detail="Failed to parse webpage or URL content.")
        source_name = url
    else:
        # Check if there are already processed sources for this product
        source = db.query(Source).filter(
            Source.product_id == product_id,
            Source.name == source_name
        ).first()
        
        if not source or not os.path.exists(source.file_path):
            raise HTTPException(status_code=404, detail="Uploaded source file not found. Upload it first.")
            
        # Re-parse to get chunks
        doc_data = extract_text_from_pdf(source.file_path)
        doc_data["tables"] = extract_tables_from_pdf(source.file_path)
        chunks = process_document_to_chunks(doc_data, source_name)

    # Run AI & Validation pipeline orchestration
    try:
        product = orchestrator.run_analysis(db, product_id, chunks, source_name)
        return {
            "message": "Analysis completed and saved successfully",
            "product_id": product.id,
            "review_required": product.review_required
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Orchestration failure: {str(e)}")


@app.get("/product/{id}", response_model=ProductResponse, summary="Retrieve product twin record")
def get_product(id: str, db: Session = Depends(get_db)):
    """
    Returns the complete product twin record matching the Shared Data Contract shape exactly.
    Includes resolved/verified attributes, evidence citations, and active conflicts.
    """
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Map database records to response structure
    attributes_dict = {}
    for attr in product.attributes:
        evidence_list = [
            EvidenceSchema(source=ev.source, page=ev.page, content=ev.content)
            for ev in attr.evidence
        ]
        attributes_dict[attr.name] = AttributeValueSchema(
            value=attr.value,
            unit=attr.unit,
            confidence=attr.confidence,
            status=attr.status,
            evidence=evidence_list
        )

    conflicts_list = [
        ConflictSchema(
            id=c.id,
            attribute_name=c.attribute_name,
            source_1=c.source_1,
            value_1=c.value_1,
            source_2=c.source_2,
            value_2=c.value_2,
            description=c.description,
            status=c.status
        )
        for c in product.conflicts if c.status == "pending"
    ]

    sources_list = [src.name for src in product.sources]

    return ProductResponse(
        product_id=product.id,
        manufacturer=product.manufacturer,
        category=product.category,
        attributes=attributes_dict,
        conflicts=conflicts_list,
        sources=sources_list,
        review_required=product.review_required
    )


@app.get("/product/{id}/evidence", summary="Get evidence citations list")
def get_product_evidence(id: str, db: Session = Depends(get_db)):
    """Returns list of evidence citations supporting all attributes of this product."""
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    evidence_results = []
    for attr in product.attributes:
        for ev in attr.evidence:
            evidence_results.append({
                "attribute_name": attr.name,
                "value": attr.value,
                "unit": attr.unit,
                "source": ev.source,
                "page": ev.page,
                "snippet": ev.content
            })
    return evidence_results


@app.get("/product/{id}/conflicts", summary="Get active conflicts list")
def get_product_conflicts(id: str, db: Session = Depends(get_db)):
    """Returns list of conflict items logged for this product."""
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    return [
        {
            "id": c.id,
            "attribute_name": c.attribute_name,
            "source_1": c.source_1,
            "value_1": c.value_1,
            "source_2": c.source_2,
            "value_2": c.value_2,
            "description": c.description,
            "status": c.status
        }
        for c in product.conflicts
    ]


@app.post("/review/{id}", summary="Submit human reviewer override or confirmation")
def review_product_attribute(
    id: str,
    review: ReviewRequest,
    db: Session = Depends(get_db)
):
    """
    Accepts human reviewer input to resolve a conflict or update/approve an attribute.
    Overwrites the database value, marks the attribute status, and marks conflicts as resolved.
    """
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Find the attribute
    attr = db.query(Attribute).filter(
        Attribute.product_id == id,
        Attribute.name == review.attribute_name
    ).first()
    
    if not attr:
        # Create it if it doesn't exist
        attr = Attribute(
            product_id=id,
            name=review.attribute_name,
            value=review.approved_value,
            unit=review.approved_unit,
            confidence=1.0,
            status=review.status
        )
        db.add(attr)
    else:
        # Update values
        attr.value = review.approved_value
        attr.unit = review.approved_unit
        attr.confidence = 1.0
        attr.status = review.status
        
    # Add human override evidence citation
    db_evidence = Evidence(
        attribute_id=attr.id,
        source="Human Reviewer Override",
        page=None,
        content=f"Human override: Value set to {review.approved_value} {review.approved_unit or ''}"
    )
    db.add(db_evidence)
    
    # Mark related conflicts as resolved
    conflicts = db.query(Conflict).filter(
        Conflict.product_id == id,
        Conflict.attribute_name == review.attribute_name,
        Conflict.status == "pending"
    ).all()
    for conf in conflicts:
        conf.status = "resolved"
        
    # Check if there are any remaining pending conflicts
    remaining_conflicts = db.query(Conflict).filter(
        Conflict.product_id == id,
        Conflict.status == "pending"
    ).count()
    
    product.review_required = (remaining_conflicts > 0)
    db.commit()
    
    return {"message": "Attribute updated and conflicts resolved successfully"}


@app.get("/product/{id}/export", summary="Export product twin record")
def export_product_twin(
    id: str,
    format: str = Query("json", regex="^(json|csv)$"),
    db: Session = Depends(get_db)
):
    """Exports the verified product twin attributes as a downloadable JSON or CSV file."""
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if format == "json":
        # Format as JSON
        data = {
            "product_id": product.id,
            "manufacturer": product.manufacturer,
            "category": product.category,
            "attributes": {
                attr.name: {"value": attr.value, "unit": attr.unit, "confidence": attr.confidence, "status": attr.status}
                for attr in product.attributes
            }
        }
        return JSONResponse(
            content=data,
            headers={"Content-Disposition": f"attachment; filename=product_twin_{id}.json"}
        )
    else:
        # Format as CSV
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["Product ID", "Manufacturer", "Category", "Attribute Name", "Value", "Unit", "Confidence", "Status"])
        for attr in product.attributes:
            writer.writerow([
                product.id,
                product.manufacturer or "",
                product.category or "",
                attr.name,
                attr.value,
                attr.unit or "",
                attr.confidence,
                attr.status
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=product_twin_{id}.csv"}
        )


@app.get("/product/{id}/graph", summary="Get product knowledge graph")
def get_product_knowledge_graph(id: str, db: Session = Depends(get_db)):
    """
    Returns the Network Graph payload (nodes and edges) for the product twin database
    by invoking build_knowledge_graph.
    """
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    try:
        graph_data = build_knowledge_graph(db)
        return graph_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build knowledge graph: {str(e)}")


