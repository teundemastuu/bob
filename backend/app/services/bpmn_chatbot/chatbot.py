"""LLM instructions made by Teun de Mast.
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path

import httpx

from app.services.llm_client import call_openai

from .storage import (
    ensure_storage,
    add_entry_to_database,
    save_description_content,
    get_description_content,
)
# XML Generation done via a separate service, see https://isys.uni-klu.ac.at/pubserv/BPMN-Chatbot/v2/
BPMN_GENERATOR_URL = os.getenv("BPMN_GENERATOR_URL", "http://localhost:8098")
BPMN_GENERATOR_TIMEOUT = 60


def _save_rendered_json(paths, thread_id: str, processed_json: dict) -> None:
    rendered_dir = paths.base_dir / "rendered_json"
    rendered_dir.mkdir(parents=True, exist_ok=True)
    rendered_path = rendered_dir / f"{thread_id}.json"
    rendered_path.write_text(json.dumps(processed_json, indent=2), encoding="utf-8")


def _truncate(text: str, max_chars: int = 12000) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n[TRUNCATED]"


def _create_llm_process_description(api_key: str | None, model_json: dict) -> str | None:
    context = _truncate(json.dumps(model_json, ensure_ascii=False))
    system_prompt = _load_bpmn_summariser_instructions()
    user_prompt = "BPMN model JSON:\n" + context
    text = call_openai(
        api_key,
        system=system_prompt,
        user=user_prompt,
    )
    if not text:
        return None
    normalized = text.strip()
    return normalized or None


def _find_and_parse_json(input_text: str) -> dict | None:
    match = re.search(r"{[\s\S]*}", input_text)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def _load_llm_instructions() -> str:
    workspace_root = Path(__file__).resolve().parents[3]
    path = workspace_root / "app" / "services" / "bpmn_chatbot" / "bpmn_chatbot_instructions.txt"
    return path.read_text(encoding="utf-8")


def _load_bpmn_summariser_instructions() -> str:
    workspace_root = Path(__file__).resolve().parents[3]
    path = workspace_root / "app" / "services" / "bpmn_chatbot" / "bpmn_summariser.txt"
    return path.read_text(encoding="utf-8")

def _load_bpmn_feedback_generator_instructions() -> str:
    workspace_root = Path(__file__).resolve().parents[3]
    path = workspace_root / "app" / "services" / "bpmn_chatbot" / "bpmn_feedback_generator.txt"
    return path.read_text(encoding="utf-8")

def _create_bpmn_json_response(
    api_key: str | None,
    scenario: str,
    base_dir: Path | None = None,
    current_model: dict | None = None,
) -> dict | None:
    system_prompt = _load_llm_instructions()

    if current_model:
        user_prompt = "\n\n".join(
            [
                "Edit the existing BPMN JSON model based on the requested change.",
                f"Requested change:\n{scenario}",
                "Existing BPMN model:",
                json.dumps(current_model, ensure_ascii=False),
                "Return the full updated model as valid JSON.",
            ]
        )
    else:
        user_prompt = scenario

    output_json = call_openai(
        api_key,
        system=system_prompt,
        user=user_prompt,
        response_format="json_object",
    )
    if not isinstance(output_json, dict):
        return None

    parsed = output_json
    if not isinstance(parsed.get("pools"), list):
        return None
    return parsed


def _generate_xml_via_service(model_json: dict) -> tuple[dict, str] | None:
    url = f"{BPMN_GENERATOR_URL.rstrip('/')}/generate"
    try:
        response = httpx.post(url, json=model_json, timeout=BPMN_GENERATOR_TIMEOUT)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return None

    processed_json = payload.get("processedJson") if isinstance(payload, dict) else None
    bpmn_xml = payload.get("bpmnXML") if isinstance(payload, dict) else None

    if not isinstance(bpmn_xml, str) or not bpmn_xml.strip():
        return None

    if not isinstance(processed_json, dict):
        processed_json = model_json

    return processed_json, bpmn_xml


def _handle_bpmn_generation(
    api_key: str | None,
    thread_id: str,
    scenario: str,
    source_thread_id: str | None = None,
    base_dir: Path | None = None,
) -> bool:
    paths = ensure_storage(base_dir)
    existing_json: dict | None = None

    if source_thread_id:
        json_path = paths.json_dir / f"{source_thread_id}.json"
        if not json_path.exists():
            return False
        try:
            existing_json = json.loads(json_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return False

    parsed = _create_bpmn_json_response(api_key, scenario, base_dir, current_model=existing_json)
    if parsed is None:
        return False

    generated = _generate_xml_via_service(parsed)
    if generated is None:
        return False
    processed_json, bpmn_xml = generated

    json_path = paths.json_dir / f"{thread_id}.json"
    xml_path = paths.xml_dir / f"{thread_id}.xml"
    json_path.write_text(json.dumps(parsed, indent=2), encoding="utf-8")
    _save_rendered_json(paths, thread_id, processed_json)
    xml_path.write_text(bpmn_xml, encoding="utf-8")

    add_entry_to_database("", scenario, thread_id, base_dir)

    return True


def generate_response(
    scenario: str,
    api_key: str | None = None,
    base_dir: Path | None = None,
) -> tuple[str, str] | str:
    thread_id = uuid.uuid4().hex
    if not _handle_bpmn_generation(api_key, thread_id, scenario, None, base_dir):
        return "Error"

    paths = ensure_storage(base_dir)
    xml_path = paths.xml_dir / f"{thread_id}.xml"
    return thread_id, xml_path.read_text(encoding="utf-8")


def continue_thread(
    scenario: str,
    thread_id: str,
    api_key: str | None = None,
    base_dir: Path | None = None,
) -> tuple[str, str] | str:
    new_thread_id = uuid.uuid4().hex
    if not _handle_bpmn_generation(api_key, new_thread_id, scenario, thread_id, base_dir):
        return "Error"

    paths = ensure_storage(base_dir)
    xml_path = paths.xml_dir / f"{new_thread_id}.xml"
    return new_thread_id, xml_path.read_text(encoding="utf-8")


def generate_feedback_description(
    thread_id: str,
    selected_session_contexts: list[str],
    resolved_inconsistency_instructions: list[str] | None = None,
    api_key: str | None = None,
    base_dir: Path | None = None,
) -> str | None:
    description_payload = get_description_content(thread_id, base_dir)
    current_description = str(description_payload.get("description") or "").strip()

    if not selected_session_contexts:
        return None

    system_prompt = _load_bpmn_feedback_generator_instructions()

    user_prompt = "\n\n".join(
        [
            "Current BPMN process description:",
            current_description,
            "Selected new interview knowledge:",
            "\n\n".join(selected_session_contexts),
            "Inconsistency instructions that must be respected:",
            "\n".join(f"- {item}" for item in (resolved_inconsistency_instructions or [])) or "[none]",
        ]
    )

    text = call_openai(
        api_key,
        system=system_prompt,
        user=user_prompt,
    )
    if not text:
        return None
    return text.strip()


def generate_and_save_description_for_thread(
    thread_id: str,
    *,
    api_key: str | None = None,
    description_override: str | None = None,
    base_dir: Path | None = None,
) -> None:
    try:
        paths = ensure_storage(base_dir)
        json_path = paths.json_dir / f"{thread_id}.json"
        if not json_path.exists():
            return

        try:
            model_json = json.loads(json_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return

        override = (description_override or "").strip()
        if override:
            description = override
        else:
            description = _create_llm_process_description(api_key, model_json)

        if not description:
            return

        save_description_content(thread_id, {"description": description}, base_dir)
    except Exception:
        return
