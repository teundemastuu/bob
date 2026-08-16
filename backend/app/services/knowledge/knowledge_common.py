"""LLM instructions made by Teun de Mast.
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from __future__ import annotations 

import re
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import decrypt_openai_key
from app.models.interview import InterviewSession
from app.models.process import Process, process_experts
from app.models.user import User


def normalize_text(value: str) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^a-z0-9@:\-\s]", "", text)
    return text.strip()


def build_question_session_map(sessions_payload: list[dict[str, Any]]) -> dict[str, set[str]]:
    result: dict[str, set[str]] = {}
    for session in sessions_payload:
        session_id = str(session.get("session_id") or "").strip()
        if not session_id:
            continue
        for qa in (session.get("qa_items") or []):
            question = normalize_text(str(qa.get("question") or ""))
            if not question:
                continue
            result.setdefault(question, set()).add(session_id)
    return result


def linked_sessions_from_evidence_raw(evidence_raw: list, question_session_map: dict[str, set[str]]) -> list[str]:
    session_ids: set[str] = set()
    for entry in (evidence_raw or []):
        if not isinstance(entry, dict):
            continue
        direct_session = str(entry.get("session_id") or entry.get("sessionId") or entry.get("interview_session_id") or "").strip()
        if direct_session:
            session_ids.add(direct_session)
        question = normalize_text(str(entry.get("question") or ""))
        if question and question in question_session_map:
            session_ids.update(question_session_map[question])
    return sorted(session_ids)


def load_linked_sessions(db: Session, session_ids: list[str]) -> list[InterviewSession]:
    if not session_ids:
        return []

    sessions = db.query(InterviewSession).filter(InterviewSession.id.in_(session_ids)).all()
    sessions_by_id = {str(session.id): session for session in sessions}
    return [sessions_by_id[session_id] for session_id in session_ids if session_id in sessions_by_id]


def assert_process_owned(db: Session, process_id: UUID, analyst: User) -> Process:
    process = db.get(Process, process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.created_by_id != analyst.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your process")
    return process


def get_openai_api_key_or_error(analyst: User) -> str:
    if not analyst.openai_api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key is required")
    return decrypt_openai_key(analyst.openai_api_key)


def build_completed_sessions_payload(
    db: Session,
    process: Process,
) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, str]]:
    sessions = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.process_id == process.id,
            InterviewSession.status == "completed",
        )
        .order_by(InterviewSession.created_at.asc())
        .all()
    )

    role_rows = db.execute(
        process_experts.select().with_only_columns(
            process_experts.c.expert_id,
            process_experts.c.role,
        ).where(process_experts.c.process_id == process.id)
    ).fetchall()
    expert_roles = {str(row.expert_id): row.role for row in role_rows}

    process_payload = {
        "id": str(process.id),
        "name": process.name,
        "description": process.description,
        "expert_roles": expert_roles,
    }
    sessions_payload: list[dict[str, Any]] = []
    for session in sessions:
        db.refresh(session)
        sessions_payload.append(
            {
                "session_id": str(session.id),
                "expert_id": str(session.expert_id),
                "expert_email": session.expert.email if session.expert else None,
                "expert_role": expert_roles.get(str(session.expert_id)),
                "round_number": session.round_number,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "qa_items": [
                    {
                        "qa_id": str(qa.id),
                        "question": qa.question,
                        "answer": qa.answer,
                        "step_id": qa.step_id,
                    }
                    for qa in (session.qa_items or [])
                ],
            }
        )
    return process_payload, sessions_payload, expert_roles
