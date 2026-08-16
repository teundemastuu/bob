"""LLM instructions made by Teun de Mast.
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from pathlib import Path

from app.services.llm_client import call_openai

SUMMARY_INSTRUCTIONS_PATH = Path(__file__).resolve().parent / "summary_instructions.txt"

def _load_summary_instructions() -> str:
    return SUMMARY_INSTRUCTIONS_PATH.read_text(encoding="utf-8")

def summarize_session(
    *,
    qa_items: list[dict],
    process_name: str | None = None,
    expert_role: str | None = None,
    api_key: str,
) -> dict | None:
    if not qa_items:
        return None

    qa_text = "\n".join(
        f"Q: {item.get('question', '')}\nA: {item.get('answer', '')}"
        for item in qa_items
    )
    user_prompt = f"Process: {process_name}\nExpert role: {expert_role}\n\nTranscript:\n{qa_text}"

    system_instructions = _load_summary_instructions()

    try:
        parsed = call_openai(
            api_key,
            system=system_instructions,
            user=user_prompt,
            response_format="json_object",
        )
        if isinstance(parsed, dict):
            return parsed
        return None
    except Exception:
        return None
