from pydantic import BaseModel, Field
from typing import Any

class Evidence(BaseModel):
    source: str
    source_tier: str | None = None
    page: int | None = None
    raw_value: Any = None

class Attribute(BaseModel):
    value: Any
    unit: str | None = None
    confidence: float = 0.0
    status: str = "pending"  # verified | conflict | pending | flagged
    evidence: list[Evidence] = Field(default_factory=list)

class Conflict(BaseModel):
    attribute: str
    values: list[dict]        # [{"source": str, "value": Any, "tier": str}]
    resolved_value: Any = None
    reasoning: str | None = None
    status: str = "unresolved"  # resolved | human_review | unresolved

class Product(BaseModel):
    product_id: str
    manufacturer: str | None = None
    category: str | None = None
    attributes: dict[str, Attribute] = Field(default_factory=dict)
    conflicts: list[Conflict] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    review_required: bool = False