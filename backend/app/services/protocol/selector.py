"""LLM instructions made by Teun de Mast.
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.process import Process, process_experts
from app.models.interview import InterviewSession
from app.models.knowledge import InterviewInconsistency, InterviewKnowledgeGap
from app.models.user import User
from app.services.bpmn_chatbot.storage import get_latest_thread_for_process, get_description_content

TARGET_RECENT_RAW_COUNT = 4
SUMMARY_TOP_K = 8


def session_to_dict(session: InterviewSession, use_summary: bool = False, expert_role: str | None = None) -> dict:
    base = {"round_number": session.round_number}
    if use_summary and isinstance(getattr(session, 'session_summary', None), dict):
        base["summary"] = session.session_summary
    else:
        qa_items = [
            {"question": item.question, "answer": item.answer}
            for item in session.qa_items
        ]
        base["qa_items"] = qa_items

    base["expert_role"] = expert_role
    return base

def _select_session_payloads(
    *,
    target_sessions: list[InterviewSession],
    other_sessions: list[InterviewSession],
    selected_inconsistencies: list[dict],
    selected_knowledge_gaps: list[dict],
    role_map: dict | None = None,
) -> tuple[list[dict], list[dict]]:
    """Selects which interview sessions should be included as raw input,
      which should be summarized and which should be excluded, 
      based on links to selected inconsistencies/gaps.
       Returns two lists of session payloads (one for target expert, one for other experts)
      with the same structure."""
    linked_session_ids: set[str] = set()
    for item in selected_inconsistencies:
        linked_session_ids.update(str(sid) for sid in (item.get("linked_session_ids") or []))
    for item in selected_knowledge_gaps:
        linked_session_ids.update(str(sid) for sid in (item.get("linked_session_ids") or []))

    forced_raw_target_ids: set[str] = set()
    for index, session in enumerate(target_sessions):
        if index < TARGET_RECENT_RAW_COUNT:
            forced_raw_target_ids.add(str(session.id))

    hard_raw_ids = linked_session_ids | forced_raw_target_ids

    candidate_pool: list[InterviewSession] = []
    for session in target_sessions:
        if str(session.id) not in hard_raw_ids:
            candidate_pool.append(session)
    for session in other_sessions:
        if str(session.id) not in hard_raw_ids:
            candidate_pool.append(session)

    summary_ids: set[str] = set()
    if SUMMARY_TOP_K > 0:
        for session in candidate_pool:
            if len(summary_ids) >= SUMMARY_TOP_K:
                break
            if isinstance(getattr(session, "session_summary", None), dict):
                summary_ids.add(str(session.id))

    target_payloads: list[dict] = []
    for session in target_sessions:
        session_id = str(session.id)
        role = None
        if role_map is not None:
            role = role_map.get(session.expert_id)
        if session_id in hard_raw_ids:
            target_payloads.append(session_to_dict(session, use_summary=False, expert_role=role))
        elif session_id in summary_ids:
            target_payloads.append(session_to_dict(session, use_summary=True, expert_role=role))

    other_payloads: list[dict] = []
    for session in other_sessions:
        session_id = str(session.id)
        role = None
        if role_map is not None:
            role = role_map.get(session.expert_id)
        if session_id in hard_raw_ids:
            other_payloads.append(session_to_dict(session, use_summary=False, expert_role=role))
        elif session_id in summary_ids:
            other_payloads.append(session_to_dict(session, use_summary=True, expert_role=role))

    return target_payloads, other_payloads


def derive_llm_inputs(
    *,
    process_id: UUID,
    expert_id: UUID,
    round_number: int,
    db: Session,
    analyst: User,
    selected_inconsistency_ids: list[str] | None = None,
    selected_gap_ids: list[str] | None = None,
    selected_bpmn_thread_id: str | None = None,
) -> dict:
    process = db.get(Process, process_id)

    role_row = db.execute(
        select(process_experts.c.role).where(
            process_experts.c.process_id == process_id,
            process_experts.c.expert_id == expert_id,
        )
    ).first()
    target_role = role_row[0] if role_row else None

    target_sessions = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.process_id == process_id,
            InterviewSession.expert_id == expert_id,
            InterviewSession.status == "completed",
            InterviewSession.round_number < round_number,
        )
        .order_by(InterviewSession.created_at.desc())
        .all()
    )

    other_sessions = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.process_id == process_id,
            InterviewSession.expert_id != expert_id,
            InterviewSession.status == "completed",
        )
        .order_by(InterviewSession.created_at.desc())
        .all()
    )

    selected_ids = [str(item).strip() for item in (selected_inconsistency_ids or []) if str(item).strip()]
    selected_inconsistencies = []
    if selected_ids:
        rows = (
            db.query(InterviewInconsistency)
            .filter(
                InterviewInconsistency.process_id == process_id,
                InterviewInconsistency.status == "unresolved",
                InterviewInconsistency.signature.in_(selected_ids),
            )
            .all()
        )
        selected_inconsistencies = [
            {
                "title": row.title,
                "description": row.description,
            }
            for row in rows
        ]

    selected_gap_id_values = [str(item).strip() for item in (selected_gap_ids or []) if str(item).strip()]
    selected_knowledge_gaps = []
    if selected_gap_id_values:
        gap_rows = (
            db.query(InterviewKnowledgeGap)
            .filter(
                InterviewKnowledgeGap.process_id == process_id,
                InterviewKnowledgeGap.status == "unresolved",
                InterviewKnowledgeGap.signature.in_(selected_gap_id_values),
            )
            .all()
        )
        selected_knowledge_gaps = [
            {
                "title": row.title,
                "description": row.description,
            }
            for row in gap_rows
        ]

    role_rows = db.execute(
        select(process_experts.c.expert_id, process_experts.c.role).where(
            process_experts.c.process_id == process_id
        )
    ).fetchall() # we need the role of the expert which is not directly available on the session.
    role_map = {row[0]: row[1] for row in role_rows}

    target_payloads, other_payloads = _select_session_payloads(
        target_sessions=target_sessions,
        other_sessions=other_sessions,
        selected_inconsistencies=selected_inconsistencies,
        selected_knowledge_gaps=selected_knowledge_gaps,
        role_map=role_map,
    )

    selected_thread = str(selected_bpmn_thread_id).strip() if selected_bpmn_thread_id else None
    if not selected_thread:
        selected_thread = get_latest_thread_for_process(str(process_id))

    current_model_description = None
    if selected_thread:
        description_payload = get_description_content(selected_thread)
        if isinstance(description_payload, dict):
            text = str(description_payload.get("description") or "").strip()
            if text:
                current_model_description = {"description": text}

    return {
        "process": {"name": process.name if process else None, "description": process.description if process else None},
        "target_expert": {"role": target_role},
        "past_interviews_target_expert": target_payloads,
        "past_interviews_other_experts": other_payloads,
        "selected_unresolved_inconsistencies": selected_inconsistencies,
        "selected_unresolved_knowledge_gaps": selected_knowledge_gaps,
        "current_model_description": current_model_description,
    }
