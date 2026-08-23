import sys
import os

# Ensure backend and database models can be imported natively
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy.orm import Session
from database.models import Product, Source, Attribute, Evidence

def build_knowledge_graph(db: Session) -> dict:
    """
    Extracts relational SQL data and transforms it into an optimized Network Graph payload 
    (Nodes & Edges) for frontend library rendering.
    """
    nodes = []
    edges = []
    
    # 1. Fetching all core relational tables
    products = db.query(Product).all()
    sources = db.query(Source).all()
    attributes = db.query(Attribute).all()
    
    # Track node IDs to avoid adding duplicates in dense networks
    node_registry = set()
    
    # 2. Add Product Nodes
    for p in products:
        node_id = f"PRODUCT_{p.id}"
        if node_id not in node_registry:
            nodes.append({
                "id": node_id,
                "group": "Product",
                "label": f"{p.manufacturer or 'Unknown'} {p.id}",
                "category": p.category
            })
            node_registry.add(node_id)
            
    # 3. Add Source Nodes and Edges
    for s in sources:
        node_id = f"SOURCE_{s.id}"
        if node_id not in node_registry:
            nodes.append({
                "id": node_id,
                "group": "Source",
                "label": s.name,
                "type": s.source_type,
                "trust_score": s.trust_score
            })
            node_registry.add(node_id)
            
        # Draw Edge: Source -> Product
        edges.append({
            "source": node_id,
            "target": f"PRODUCT_{s.product_id}",
            "relationship": "DESCRIBES"
        })
        
    # 4. Add Attribute Nodes, Evidence Nodes, and Edges
    for a in attributes:
        node_id = f"ATTR_{a.id}"
        if node_id not in node_registry:
            nodes.append({
                "id": node_id,
                "group": "Attribute",
                "label": f"{a.name}: {a.value}",
                "unit": a.unit,
                "confidence": a.confidence
            })
            node_registry.add(node_id)
            
        # Draw Edge: Product -> Attribute
        edges.append({
            "source": f"PRODUCT_{a.product_id}",
            "target": node_id,
            "relationship": "HAS_ATTRIBUTE"
        })
        
        # Iterating nested architecture for Evidences
        for e in a.evidence:
            evid_node_id = f"EVIDENCE_{e.id}"
            if evid_node_id not in node_registry:
                nodes.append({
                    "id": evid_node_id,
                    "group": "Evidence",
                    "label": f"Excerpt Pg {e.page or 'N/A'}",
                    "content": e.content
                })
                node_registry.add(evid_node_id)
                
            # Draw Edge: Attribute -> Evidence
            edges.append({
                "source": node_id,
                "target": evid_node_id,
                "relationship": "SUPPORTED_BY"
            })
            
            # Map Evidence to its source node if possible
            matching_source = db.query(Source).filter(Source.name == e.source, Source.product_id == a.product_id).first()
            if matching_source:
                edges.append({
                    "source": evid_node_id,
                    "target": f"SOURCE_{matching_source.id}",
                    "relationship": "EXTRACTED_FROM"
                })
                
    return {
        "nodes": nodes,
        "edges": edges,
        "metrics": {
            "node_count": len(nodes),
            "edge_count": len(edges)
        }
    }

if __name__ == "__main__":
    import json
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from database.database import Base
    
    # Bootstrapping local memory DB strictly for localized printing structural validation
    print("Evaluating Knowledge Graph translation schema...")
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionMock = sessionmaker(bind=engine)
    db = SessionMock()
    
    # Generating mock relations matching production expectations
    prod = Product(id="ACS580-TEST", manufacturer="ABB", category="Drive")
    src = Source(product_id="ACS580-TEST", source_type="pdf", name="ABB Catalog")
    attr = Attribute(product_id="ACS580-TEST", name="Weight", value="15", unit="kg", confidence=0.97)
    evid = Evidence(attribute_id=1, source="ABB Catalog", page=2, content="Weight is 15kg")
    
    db.add(prod)
    db.add(src)
    db.commit() # Flush relationships
    
    attr.product_id = prod.id
    db.add(attr)
    db.commit()
    
    evid.attribute_id = attr.id
    db.add(evid)
    db.commit()
    
    result = build_knowledge_graph(db)
    print(json.dumps(result, indent=2))
