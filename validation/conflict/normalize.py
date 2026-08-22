UNIT_CONVERSIONS = {
    ("g", "kg"): 0.001, ("kg", "kg"): 1, ("lb", "kg"): 0.453592,
    ("mm", "m"): 0.001, ("m", "m"): 1, ("in", "m"): 0.0254,
}

def normalize_numeric(value: float, unit: str, target_unit: str) -> float:
    factor = UNIT_CONVERSIONS.get((unit, target_unit))
    if factor is None:
        raise ValueError(f"No conversion defined for {unit} -> {target_unit}")
    return round(value * factor, 6)

def normalize_categorical(value: str) -> str:
    return " ".join(value.strip().lower().split())