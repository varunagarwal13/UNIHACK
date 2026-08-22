# Source trust tiers (Section 7)
SOURCE_TRUST = {
    "manufacturer_datasheet": 99,
    "manufacturer_website": 98,
    "authorized_distributor": 88,
    "industry_distributor": 75,
    "unknown_reseller": 45,
    "marketplace_listing": 25,
}

def classify_source(source_name: str) -> str:
    """Very simple keyword classifier — swap for Person 3's source metadata once real data lands."""
    s = source_name.lower()
    if "datasheet" in s:
        return "manufacturer_datasheet"
    if "manufacturer" in s and ("site" in s or "website" in s or "product page" in s):
        return "manufacturer_website"
    if "authorized" in s or "official distributor" in s:
        return "authorized_distributor"
    if "distributor" in s:
        return "industry_distributor"
    if "marketplace" in s or "amazon" in s or "ebay" in s:
        return "marketplace_listing"
    return "unknown_reseller"

def trust_score(source_name: str) -> int:
    return SOURCE_TRUST[classify_source(source_name)]