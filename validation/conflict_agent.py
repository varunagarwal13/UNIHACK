import os

def build_investigation_prompt(attribute: str, dominant: list[dict], conflicting: list[dict]) -> str:
    return f"""You are investigating a data conflict for the attribute "{attribute}".
Agreeing sources: {dominant}
Conflicting sources: {conflicting}
In one sentence, state the most likely reason for the discrepancy (e.g. different product variant,
packaged vs. net weight, unit mismatch, outdated listing). Be concise and concrete."""

def investigate_conflict(attribute: str, dominant: list[dict], conflicting: list[dict]) -> str:
    """Swap in your team's LLM client (Gemini/GPT per the stack). Kept provider-agnostic here."""
    prompt = build_investigation_prompt(attribute, dominant, conflicting)
    if os.getenv("HACKATHON_LLM_PROVIDER") == "mock":
        return "Conflicting value likely reflects packaged/shipping weight rather than product weight."
    # e.g.: response = gemini_client.generate_content(prompt); return response.text
    raise NotImplementedError("Wire up Gemini/GPT client here")