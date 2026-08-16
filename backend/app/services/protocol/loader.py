"""LLM instructions made by Teun de Mast.
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

import json
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.security import decrypt_openai_key
from app.services.protocol.selector import derive_llm_inputs
from app.services.protocol.validators import is_valid_protocol
from app.services.llm_client import call_openai
from pathlib import Path

LLM_INSTRUCTIONS_DISCOVERY_PATH = Path(__file__).resolve().parent / "llm_instructions_discovery.txt"
LLM_INSTRUCTIONS_VALIDATION_PATH = Path(__file__).resolve().parent / "llm_instructions_validation.txt"
LLM_INSTRUCTIONS_FEEDBACK_PATH = Path(__file__).resolve().parent / "llm_instructions_feedback.txt"

def load_llm_instructions(category: str | None = None) -> str:
    if category == "validation":
        path = LLM_INSTRUCTIONS_VALIDATION_PATH
    else:
        path = LLM_INSTRUCTIONS_DISCOVERY_PATH
    return path.read_text(encoding="utf-8")

def generate_protocol(
    *,
    process_id: UUID,
    expert_id: UUID,
    round_number: int,
    db: Session,
    analyst,
    category: str | None = None,
    length: str | None = None,
    followup_count: int | None = None,
    additional_info: str | None = None,
    selected_inconsistency_ids: list[str] | None = None,
    selected_gap_ids: list[str] | None = None,
    selected_bpmn_thread_id: str | None = None,
) -> dict:
    api_key = decrypt_openai_key(analyst.openai_api_key) if analyst.openai_api_key else None
    filtered_inconsistency_ids = selected_inconsistency_ids if category == "validation" else []
    filtered_gap_ids = selected_gap_ids if category == "discovery" else []

    llm_inputs = derive_llm_inputs(
        process_id=process_id,
        expert_id=expert_id,
        round_number=round_number,
        db=db,
        analyst=analyst,
        selected_inconsistency_ids=filtered_inconsistency_ids,
        selected_gap_ids=filtered_gap_ids,
        selected_bpmn_thread_id=selected_bpmn_thread_id,
    )
    params = {"length": length, "followup_count": followup_count, "additional_info": additional_info}
    if api_key:
        instructions = load_llm_instructions(category)
        prompt = f"Generation params:\n{json.dumps(params, ensure_ascii=False, indent=2)}\n\ncontext:\n{json.dumps(llm_inputs, ensure_ascii=False, indent=2)}"
        drafted = call_openai(
            api_key,
            system=instructions,
            user=prompt,
            response_format="json_object",
        )
        if is_valid_protocol(drafted):
            return drafted
    return None


def generate_protocol_from_feedback(
    *,
    process_id: UUID,
    expert_id: UUID,
    round_number: int,
    db: Session,
    analyst,
    base_protocol: dict,
    feedback: str,
    category: str | None = None,
    length: str | None = None,
    followup_count: int | None = None,
    additional_info: str | None = None,
) -> dict:
    api_key = decrypt_openai_key(analyst.openai_api_key) if analyst.openai_api_key else None
    llm_inputs = derive_llm_inputs(process_id=process_id, expert_id=expert_id, round_number=round_number, db=db, analyst=analyst)
    params = {"length": length, "followup_count": followup_count, "additional_info": additional_info}
    if api_key:
        instructions = load_llm_instructions(category)
        feedback_instructions = LLM_INSTRUCTIONS_FEEDBACK_PATH.read_text(encoding="utf-8")
        prompt = (
            f"{instructions}\n\n"
            f"{feedback_instructions}\n\n"
            f"Generation params:\n{json.dumps(params, ensure_ascii=False, indent=2)}\n\n"
            f"Context:\n{json.dumps(llm_inputs, ensure_ascii=False, indent=2)}\n\n"
            f"Current protocol:\n{json.dumps(base_protocol, ensure_ascii=False, indent=2)}\n\n"
            f"Feedback to apply:\n{feedback}"
        )
        drafted = call_openai(
            api_key,
            system=instructions,
            user=prompt,
            response_format="json_object",
        )
        if is_valid_protocol(drafted):
            return drafted
    return base_protocol
