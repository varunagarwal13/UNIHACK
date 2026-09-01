"""
ai/schemas/product_schema.py

Pydantic models matching the Shared Data Contract (Section 5 of the team plan).
Every person's output must conform to this. Do not change shape without a group sync.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class Evidence(BaseModel):
    source: str
    page: Optional[int] = None


class Attribute(BaseModel):
    value: str
    unit: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    status: str = "unverified"  # "verified" | "unverified" | "conflict"
    evidence: List[Evidence] = []


class ProductRecord(BaseModel):
    product_id: str
    manufacturer: str
    category: str
    attributes: dict[str, Attribute]
    conflicts: List[dict] = []
    sources: List[str] = []
    review_required: bool = False