"""
bpmn_chatbot_instructions are from https://isys.uni-klu.ac.at/pubserv/BPMN-Chatbot/v2/
Other LLM instructions made by Teun de Mast.
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from __future__ import annotations

import hashlib
import json
import os
from typing import Iterable
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decrypt_openai_key
from app.models.interview import InterviewSession
from app.models.knowledge import InterviewInconsistency, InterviewKnowledgeGap
from app.models.process import Process, process_experts
from app.services.llm_client import call_openai

TARGET_RECENT_RAW_COUNT = 4
SUMMARY_TOP_K = 8


def parse_selected_session_ids(selected_ids: list[str] | None) -> list[str]:
    parsed: list[str] = []
    for item in selected_ids or []:
        value = str(item).strip()
        if value:
            parsed.append(value)
    return parsed


def serialize_session_context(session: InterviewSession, expert_role: str | None = None) -> str:
    parts: list[str] = []
    role = expert_role
    parts.append(f"Interview session {session.round_number} with role {role}")
    for idx, qa in enumerate(session.qa_items, start=1):
        parts.append(f"Q{idx}: {qa.question}")
        parts.append(f"A{idx}: {qa.answer}")
    return "\n".join(parts)


def serialize_session_summary_context(session: InterviewSession, expert_role: str | None = None) -> str:
    summary = session.session_summary if isinstance(session.session_summary, dict) else {}
    key_points = summary.get("key_points") if isinstance(summary, dict) else None
    parts: list[str] = [
        f"Interview session {session.round_number} with role={expert_role}"
    ]
    if isinstance(key_points, list):
        for point in key_points:
            text = str(point or "").strip()
            if text:
                parts.append(f"- {text}")
    return "\n".join(parts)


def select_raw_and_summary_sessions(sessions: list[InterviewSession]) -> tuple[list[InterviewSession], list[InterviewSession]]:
    if len(sessions) <= TARGET_RECENT_RAW_COUNT:
        return sessions, []

    raw_sessions = sessions[:TARGET_RECENT_RAW_COUNT]
    candidate_sessions = sessions[TARGET_RECENT_RAW_COUNT:]
    summary_sessions: list[InterviewSession] = []
    for session in candidate_sessions:
        if len(summary_sessions) >= SUMMARY_TOP_K:
            break
        if isinstance(getattr(session, "session_summary", None), dict):
            summary_sessions.append(session)
    return raw_sessions, summary_sessions


def load_completed_sessions(
    db: Session,
    *,
    process_id: str,
    selected_session_ids: list[str] | None = None,
    newest_first: bool = False,
) -> list[InterviewSession]:
    query = db.query(InterviewSession).filter(
        InterviewSession.process_id == process_id,
        InterviewSession.status == "completed",
    )
    parsed_ids = parse_selected_session_ids(selected_session_ids)
    if parsed_ids:
        query = query.filter(InterviewSession.id.in_(parsed_ids))
    query = query.order_by(
        InterviewSession.created_at.desc() if newest_first else InterviewSession.created_at.asc()
    )
    sessions = query.all()
    for session in sessions:
        db.refresh(session)
    return sessions


def session_fingerprint(session: InterviewSession) -> str:
    # To show which sessoins are new or changed (e.g. after new questions are asked)
    payload = {
        "sessionId": str(session.id),
        "processId": str(session.process_id),
        "expertId": str(session.expert_id),
        "status": session.status,
        "round": session.round_number,
        "qa": [
            {
                "step_id": item.step_id,
                "question": item.question,
                "answer": item.answer,
            }
            for item in (session.qa_items or [])
        ],
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def analyst_knowledge_instructions(
    db: Session,
    process_id: str,
    selected_session_ids: set[str] | None = None,
) -> list[str]:
    inconsistency_rows = (
        db.query(InterviewInconsistency)
        .filter(
            InterviewInconsistency.process_id == process_id,
            InterviewInconsistency.status != "ignored",
            InterviewInconsistency.analyst_input.isnot(None),
        )
        .order_by(InterviewInconsistency.updated_at.desc())
        .all()
    )
    gap_rows = (
        db.query(InterviewKnowledgeGap)
        .filter(
            InterviewKnowledgeGap.process_id == process_id,
            InterviewKnowledgeGap.status != "ignored",
            InterviewKnowledgeGap.analyst_input.isnot(None),
        )
        .order_by(InterviewKnowledgeGap.updated_at.desc())
        .all()
    )
    result = []
    selected = selected_session_ids or set()

    def _is_relevant(linked_ids) -> bool:
        if not selected:
            return False
        linked_set = {str(item) for item in (linked_ids or [])}
        return bool(linked_set & selected)

    for row in inconsistency_rows:
        if not _is_relevant(getattr(row, "linked_session_ids", [])):
            continue
        text = (row.analyst_input or "").strip()
        if not text:
            continue
        result.append(f"Inconsistency: {row.description}. Analyst instruction: {text}")
    for row in gap_rows:
        if not _is_relevant(getattr(row, "linked_session_ids", [])):
            continue
        text = (row.analyst_input or "").strip()
        if not text:
            continue
        result.append(f"Knowledge gap: {row.description}. Analyst instruction: {text}")
    return result


def _build_context(
    process: Process,
    sessions: Iterable[InterviewSession],
    role_map: dict | None = None,
    inconsistency_guidance: Iterable[str] | None = None,
) -> str:
    session_list = list(sessions)
    raw_sessions, summary_sessions = select_raw_and_summary_sessions(session_list)

    lines = [
        f"Process name: {process.name}",
        f"Initial process description: {process.description}",
        "",
        "Interviews:",
    ]
    for session in raw_sessions:
        role = None
        if role_map is not None:
            role = role_map.get(session.expert_id) or role_map.get(str(session.expert_id))
        lines.append(
            f"- Session {session.round_number} with role={role}"
        )
        for item in session.qa_items:
            question = (item.question or "").strip()
            answer = (item.answer or "").strip()
            if question or answer:
                lines.append(f"  Q: {question}")
                lines.append(f"  A: {answer}")
        lines.append("")

    if summary_sessions:
        lines.append("Interview summaries:")
        for session in summary_sessions:
            role = None
            if role_map is not None:
                role = role_map.get(session.expert_id) or role_map.get(str(session.expert_id))
            lines.append(
                f"- Session {session.round_number} with {role}:"
            )
            summary = session.session_summary if isinstance(session.session_summary, dict) else {}
            key_points = summary.get("key_points") if isinstance(summary, dict) else None
            if isinstance(key_points, list) and key_points:
                for point in key_points:
                    text = str(point or "").strip()
                    if text:
                        lines.append(f"  - {text}")
            lines.append("")

    guidance_items = [item.strip() for item in (inconsistency_guidance or []) if item and item.strip()]
    if guidance_items:
        lines.append("Analyst inconsistency and gap instructions:")
        for item in guidance_items:
            lines.append(f"- {item}")
        lines.append("")

    return "\n".join(lines).strip()


def _truncate(text: str, max_chars: int = 8000) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n[TRUNCATED]"


def generate_process_description(
    *,
    analyst_api_key: str | None,
    process: Process,
    sessions: Iterable[InterviewSession],
    role_map: dict | None = None,
    inconsistency_guidance: Iterable[str] | None = None,
) -> str:
    session_list = list(sessions)
    context = _truncate(_build_context(process, session_list, role_map, inconsistency_guidance))
    if not analyst_api_key:
        return context

    api_key = decrypt_openai_key(analyst_api_key)
    system_prompt = _load_interview_summarise_instructions()
    text = call_openai(
        api_key,
        system=system_prompt,
        user=context,
    )
    return text


def _load_interview_summarise_instructions() -> str:
    workspace_root = Path(__file__).resolve().parents[3]
    path = workspace_root / "app" / "services" / "bpmn_chatbot" / "interview_summariser.txt"
    return path.read_text(encoding="utf-8")