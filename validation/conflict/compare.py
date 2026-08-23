from collections import defaultdict
from validation.trust_scores import trust_score

def cluster_readings(readings: list[dict], tolerance: float = 0.02) -> list[list[dict]]:
    """Group readings whose values are within `tolerance` of each other (for numeric) or match exactly (for strings)."""
    clusters: list[list[dict]] = []
    
    # Sort readings. Fallback to string sort if type mismatch occurs
    try:
        sorted_readings = sorted(readings, key=lambda x: x["value"])
    except TypeError:
        sorted_readings = sorted(readings, key=lambda x: str(x["value"]))
        
    for r in sorted_readings:
        placed = False
        r_val = r["value"]
        
        # Check if current value is numeric
        try:
            r_num = float(r_val)
            is_r_num = True
        except (ValueError, TypeError):
            is_r_num = False
            
        for c in clusters:
            ref = c[0]["value"]
            
            # Check if reference value is numeric
            try:
                ref_num = float(ref)
                is_ref_num = True
            except (ValueError, TypeError):
                is_ref_num = False
                
            if is_r_num and is_ref_num:
                # Both are numeric, do tolerance comparison
                if ref_num == 0:
                    match = r_num == 0
                else:
                    match = abs(r_num - ref_num) / abs(ref_num) <= tolerance
            else:
                # At least one is non-numeric, do string comparison
                match = str(r_val).strip().lower() == str(ref).strip().lower()
                
            if match:
                c.append(r)
                placed = True
                break
        if not placed:
            clusters.append([r])
    return clusters

def compare_attribute(readings: list[dict]) -> dict:
    """Returns agreement info: dominant cluster, agreement_score, conflicting clusters."""
    clusters = cluster_readings(readings)
    clusters.sort(key=len, reverse=True)
    total = len(readings)
    dominant = clusters[0]
    agreement_score = len(dominant) / total

    for c in clusters:
        for r in c:
            r["trust"] = trust_score(r["source"])

    return {
        "agreement_score": round(agreement_score, 2),
        "dominant_cluster": dominant,
        "conflicting_clusters": clusters[1:],
        "has_conflict": len(clusters) > 1,
        "avg_trust_dominant": round(sum(r["trust"] for r in dominant) / len(dominant), 1),
        "manufacturer_confirmed": any("datasheet" in r["source"].lower() or "manufacturer" in r["source"].lower() for r in dominant),
    }