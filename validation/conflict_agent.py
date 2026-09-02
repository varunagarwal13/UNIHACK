import os
import logging

logger = logging.getLogger(__name__)

def build_investigation_prompt(attribute: str, dominant: list[dict], conflicting: list[dict]) -> str:
    return f"""You are investigating a data conflict for the attribute "{attribute}".
Agreeing sources: {dominant}
Conflicting sources: {conflicting}
In one sentence, state the most likely reason for the discrepancy (e.g. different product variant,
packaged vs. net weight, unit mismatch, outdated listing). Be concise and concrete."""

def investigate_conflict(attribute: str, dominant: list[dict], conflicting: list[dict]) -> str:
    """Swap in your team's LLM client (Gemini/GPT per the stack). Kept provider-agnostic here."""
    prompt = build_investigation_prompt(attribute, dominant, conflicting)
    if os.getenv("HACKATHON_LLM_PROVIDER") == "mock" or not os.getenv("GEMINI_API_KEY"):
        return "Conflicting value likely reflects packaged/shipping weight rather than product weight."
        
    try:
        from google import genai
        client = genai.Client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Failed to generate conflict resolution: {e}")
        return "Conflicting value likely reflects packaged/shipping weight rather than product weight."