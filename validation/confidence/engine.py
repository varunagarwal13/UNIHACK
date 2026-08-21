"""
Deterministic confidence formula (Section 3 / Person 2):
confidence = source_quality + agreement_score + evidence_count + manufacturer_confirmation
Kept as plain arithmetic — no LLM call — so it's fast and debuggable live in the demo.
"""

WEIGHTS = {
    "source_quality": 0.40,
    "agreement_score": 0.30,
    "evidence_count": 0.15,
    "manufacturer_confirmation": 0.15,
}

def evidence_count_score(n_sources: int, cap: int = 4) -> float:
    return min(n_sources, cap) / cap

def compute_confidence(
    avg_trust: float,          # 0-100, mean trust score of agreeing sources
    agreement_score: float,    # 0-1, fraction of sources that agree
    n_agreeing_sources: int,
    manufacturer_confirmed: bool,
) -> float:
    source_quality = avg_trust / 100
    ev_score = evidence_count_score(n_agreeing_sources)
    mfr_score = 1.0 if manufacturer_confirmed else 0.0

    confidence = (
        WEIGHTS["source_quality"] * source_quality
        + WEIGHTS["agreement_score"] * agreement_score
        + WEIGHTS["evidence_count"] * ev_score
        + WEIGHTS["manufacturer_confirmation"] * mfr_score
    )
    return round(min(confidence, 1.0) * 100, 1)

def route(confidence: float, has_unresolved_conflict: bool) -> str:
    """High -> auto-approve. Medium -> suggested review. Low/conflict -> human review."""
    if has_unresolved_conflict:
        return "human_review"
    if confidence >= 90:
        return "auto_approved"
    if confidence >= 70:
        return "suggested_review"
    return "human_review"