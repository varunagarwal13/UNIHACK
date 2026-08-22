from validation.conflict.compare import compare_attribute
from validation.confidence.engine import compute_confidence, route
from validation.conflict_agent import investigate_conflict
from validation.schemas import Attribute, Conflict, Evidence

def validate_attribute(name: str, readings: list[dict]) -> tuple[Attribute, Conflict | None]:
    result = compare_attribute(readings)
    confidence = compute_confidence(
        avg_trust=result["avg_trust_dominant"],
        agreement_score=result["agreement_score"],
        n_agreeing_sources=len(result["dominant_cluster"]),
        manufacturer_confirmed=result["manufacturer_confirmed"],
    )
    status = route(confidence, result["has_conflict"])

    conflict = None
    if result["has_conflict"]:
        reasoning = investigate_conflict(name, result["dominant_cluster"], result["conflicting_clusters"])
        conflict = Conflict(
            attribute=name,
            values=[{"source": r["source"], "value": r["value"], "trust": r["trust"]}
                     for c in result["conflicting_clusters"] for r in c],
            resolved_value=result["dominant_cluster"][0]["value"],
            reasoning=reasoning,
            status="human_review" if status == "human_review" else "resolved",
        )

    attribute = Attribute(
        value=result["dominant_cluster"][0]["value"],
        confidence=confidence,
        status="verified" if status == "auto_approved" else status,
        evidence=[Evidence(source=r["source"], raw_value=r["value"], source_tier=r["trust"])
                   for r in result["dominant_cluster"]],
    )
    return attribute, conflict

def validate_product(product_id: str, attribute_readings: dict[str, list[dict]]) -> dict:
    """attribute_readings: {"weight": [{"source": ..., "value": ...}, ...], ...}"""
    attributes, conflicts = {}, []
    for name, readings in attribute_readings.items():
        attr, conflict = validate_attribute(name, readings)
        attributes[name] = attr
        if conflict:
            conflicts.append(conflict)

    return {
        "product_id": product_id,
        "attributes": {k: v.model_dump() for k, v in attributes.items()},
        "conflicts": [c.model_dump() for c in conflicts],
        "review_required": any(c.status == "human_review" for c in conflicts),
    }