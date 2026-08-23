from collections import defaultdict
from validation.trust_scores import trust_score

def cluster_readings(readings: list[dict], tolerance: float = 0.02) -> list[list[dict]]:
    """Group readings whose numeric values are within `tolerance` (relative) of each other."""
    clusters: list[list[dict]] = []
    for r in sorted(readings, key=lambda x: x["value"]):
        placed = False
        for c in clusters:
            ref = c[0]["value"]
            if ref == 0:
                match = r["value"] == 0
            else:
                match = abs(r["value"] - ref) / abs(ref) <= tolerance
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