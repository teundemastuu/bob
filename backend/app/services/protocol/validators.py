"""Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""


def is_valid_protocol(payload: dict) -> bool:
    if not isinstance(payload, dict):
        return False
    purpose = payload.get("purpose")
    questions = payload.get("questions")
    if not isinstance(purpose, dict):
        return False
    if not isinstance(questions, list):
        return False
    return True
