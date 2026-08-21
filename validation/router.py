from fastapi import APIRouter
from pydantic import BaseModel
from validation.pipeline import validate_product

router = APIRouter(prefix="/validation", tags=["validation"])

class ValidateRequest(BaseModel):
    product_id: str
    attribute_readings: dict[str, list[dict]]

@router.post("/validate")
def validate(req: ValidateRequest):
    return validate_product(req.product_id, req.attribute_readings)