from pydantic import BaseModel
from typing import List, Dict, Optional

class EvidenceSchema(BaseModel):
    source: str
    page: Optional[int] = None
    snippet: Optional[str] = None

    class Config:
        from_attributes = True


class AttributeValueSchema(BaseModel):
    value: Optional[str] = None
    unit: Optional[str] = None
    confidence: float = 1.0
    status: str = "extracted"  # extracted, verified, flagged
    evidence: List[EvidenceSchema] = []

    class Config:
        from_attributes = True


class ConflictSchema(BaseModel):
    id: int
    attribute_name: str
    source_1: str
    value_1: str
    source_2: str
    value_2: str
    description: Optional[str] = None
    status: str = "pending"

    class Config:
        from_attributes = True


class DocumentSchema(BaseModel):
    id: int
    filename: str
    file_path: str
    status: str
    created_at: str

    class Config:
        from_attributes = True


class ProductResponse(BaseModel):
    product_id: str
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    attributes: Dict[str, AttributeValueSchema] = {}
    conflicts: List[ConflictSchema] = []
    sources: List[str] = []
    review_required: bool = False
    confidence: int = 0

    class Config:
        from_attributes = True


class ReviewRequest(BaseModel):
    attribute_name: str
    approved_value: str
    approved_unit: Optional[str] = None
    status: str = "verified"  # verified, flagged
    notes: Optional[str] = None
