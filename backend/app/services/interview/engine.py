"""LLM instructions made by Teun de Mast.
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from pathlib import Path
import json

from app.services.llm_client import call_openai

LLM_NEXT_QUESTION_INSTRUCTIONS_PATH = Path(__file__).resolve().parent / "llm_next_question_instructions.txt"
LLM_NEXT_QUESTION_FREE_INSTRUCTIONS_PATH = Path(__file__).resolve().parent / "llm_next_question_free_instructions.txt"

def _load_next_question_instructions() -> str:
    return LLM_NEXT_QUESTION_INSTRUCTIONS_PATH.read_text(encoding="utf-8")

def _load_next_question_free_instructions() -> str:
    return LLM_NEXT_QUESTION_FREE_INSTRUCTIONS_PATH.read_text(encoding="utf-8")


def _find_protocol_id_by_question(protocol: dict, question_text: str) -> str | None:
    if not question_text:
        return None
    target = question_text.strip()
    for q in protocol.get("questions", []) or []:
        if q.get("question") and q.get("question").strip() == target:
            return q.get("id")
        for f in q.get("followups", []) or []:
            if f.get("question") and f.get("question").strip() == target:
                return f.get("id")
    return None


def _base_question_id(step_id: str | None) -> str | None:
    if not step_id:
        return None
    return step_id.split("_s", 1)[0]


def _fallback_next_question(protocol: dict, asked_ids: set[str]) -> dict | None:
    for q in protocol.get("questions", []) or []:
        step_id = q.get("id")
        question = q.get("question")
        if step_id and question and step_id not in asked_ids:
            return {"id": step_id, "question": question}
    return None


def _qa_item_to_dict(item) -> dict:
    return {
        "step_id": getattr(item, "step_id", None) if not isinstance(item, dict) else item.get("step_id"),
        "question": getattr(item, "question", None) if not isinstance(item, dict) else item.get("question"),
        "answer": getattr(item, "answer", None) if not isinstance(item, dict) else item.get("answer"),
    }


def _allow_dynamic_followup_if_no_scenario(protocol: dict) -> bool:
    if not isinstance(protocol, dict):
        return False
    settings = protocol.get("settings")
    if not isinstance(settings, dict):
        return False
    return bool(settings.get("allow_llm_followup_if_no_scenario"))


def _protocol_purpose(protocol: dict) -> dict | None:
    return protocol.get("purpose") if isinstance(protocol, dict) else None

def _as_question_payload(item: dict) -> dict | None:
    step_id = item.get("id")
    question = item.get("question")
    if not step_id or not question:
        return None
    scenario = item.get("scenario")
    reason = item.get("reason")
    payload = {"id": step_id, 
               "question": question,
               "scenario": scenario,
               "reason": reason}
    return payload


def _next_main_candidate(protocol: dict, asked_set: set[str]) -> dict | None:
    for question in protocol.get("questions", []) or []:
        step_id = question.get("id")
        question_text = question.get("question")
        if step_id and question_text and step_id not in asked_set:
            return {"id": step_id, "question": question_text}
    return None


def _build_followup_candidates(protocol: dict, latest_answer: dict | None, asked_followup_bases: set[str], asked_set: set[str]) -> list[dict]:
    if not latest_answer:
        return []
    latest_step_id = latest_answer.get("step_id")
    latest_base_id = _base_question_id(latest_step_id)
    if not latest_base_id or latest_base_id in asked_followup_bases:
        return []

    for question in protocol.get("questions", []) or []:
        if question.get("id") != latest_base_id:
            continue
        candidates: list[dict] = []
        for followup in question.get("followups", []) or []:
            payload = _as_question_payload(followup)
            if payload and payload["id"] not in asked_set:
                candidates.append(payload)
        return candidates
    return []


def _candidate_lookup(candidates: list[dict]) -> dict[str, dict]:
    return {candidate["id"]: candidate for candidate in candidates if candidate.get("id") and candidate.get("question")}


def get_next_question(protocol: dict, qa_items: list, current_step_index: int, api_key: str | None):
    asked_ids = [
        (getattr(item, "step_id", None) if not isinstance(item, dict) else item.get("step_id"))
        for item in qa_items
    ]
    asked_ids = [i for i in asked_ids if i]
    asked_set = set(asked_ids)
    asked_followup_bases = {
        _base_question_id(i)
        for i in asked_ids
        if i and "_s" in i
    }
    latest = None
    if qa_items:
        latest = _qa_item_to_dict(qa_items[-1])

    main_candidate = _next_main_candidate(protocol, asked_set)
    followup_candidates = _build_followup_candidates(protocol, latest, asked_followup_bases, asked_set)
    candidate_lookup = _candidate_lookup(followup_candidates)
    dynamic_follow_up = _allow_dynamic_followup_if_no_scenario(protocol)

    if not followup_candidates and main_candidate:
        return {"id": main_candidate["id"], "question": main_candidate["question"]}
    if not followup_candidates and not main_candidate:
        return None

    if api_key:
        try:
            instructions = _load_next_question_instructions() if not dynamic_follow_up else _load_next_question_free_instructions()
            prompt_payload = {
                "purpose": _protocol_purpose(protocol),
                "latest_answer": latest,
                "qa_history": [_qa_item_to_dict(i) for i in qa_items],
                "possible_followups": followup_candidates,
            }
            user_content = json.dumps(prompt_payload, ensure_ascii=False, indent=2)
            messages = [
                {"role": "system", "content": instructions},
                {"role": "user", "content": user_content},
            ]
            result = call_openai(
                api_key=api_key,
                system=messages[0]["content"],
                user=messages[1]["content"],
                response_format="json_object",
            )

            if result is None or result == 'null':
                return {"id": main_candidate["id"], "question": main_candidate["question"]} if main_candidate else None
            
            step_id = result.get("step_id")
            question = result.get("question")
            if step_id == 'free':
                step_id = str(current_step_index) + "_s" + "free"
                return {"id": step_id, "question": question}

            if step_id and step_id in candidate_lookup:
                candidate = candidate_lookup[step_id]
                return {"id": candidate["id"], "question": candidate["question"]}

            if question and question.strip():
                derived_id = _find_protocol_id_by_question({"questions": followup_candidates}, question)
                if derived_id and derived_id in candidate_lookup:
                    candidate = candidate_lookup[derived_id]
                    return {"id": candidate["id"], "question": candidate["question"]}
        except (ValueError, json.JSONDecodeError) as exc:
            pass
    else:
        pass

    fallback = _fallback_next_question(protocol, asked_set) # only fallback to main questions if LLM fails
    return fallback
