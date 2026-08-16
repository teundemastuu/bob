"""LLM instructions made by Teun de Mast.
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from __future__ import annotations

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decrypt_openai_key
from app.models.interview import InterviewSession
from app.models.process import Process, process_experts
from app.models.user import User, UserRole
from app.schemas.bpmn import BpmnCreateRequest, BpmnDeleteRequest, BpmnDescriptionRequest, BpmnSaveRequest, BpmnUpdateRequest
from app.services.bpmn_chatbot.selector import (
    analyst_knowledge_instructions,
    generate_process_description,
    load_completed_sessions,
    select_raw_and_summary_sessions,
    serialize_session_context,
    session_fingerprint,
)
from app.services.bpmn_chatbot.chatbot import (
    continue_thread,
    generate_and_save_description_for_thread,
    generate_feedback_description,
    generate_response,
)
from app.services.bpmn_chatbot.storage import (
    append_thread_for_process,
    branch_history_for_process,
    clear_history_for_process,
    delete_database,
    delete_entry_by_thread,
    get_database_entries,
    get_description_content,
    get_latest_thread_for_process,
    get_thread_history_for_process,
    get_thread_used_session_snapshots,
    get_xml_content,
    save_xml_content,
    set_latest_thread_for_process,
    set_thread_used_session_snapshots,
)


def _ensure_process_owned(db: Session, process_id: str, analyst: User) -> Process:
    process = db.get(Process, process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.created_by_id != analyst.id:
        raise HTTPException(status_code=403, detail="Not your process")
    return process


def _get_process_role_map(db: Session, process_id: str) -> dict:
    role_rows = db.execute(
        select(process_experts.c.expert_id, process_experts.c.role).where(
            process_experts.c.process_id == process_id
        )
    ).fetchall()
    return {row[0]: row[1] for row in role_rows}


def get_xml_file(filename: str) -> str:
    xml = get_xml_content(filename)
    if xml is None:
        raise HTTPException(status_code=404, detail="File not found")
    return xml


def get_description_file(thread_id: str) -> dict:
    description = get_description_content(thread_id)
    if description is None:
        raise HTTPException(status_code=404, detail="Description not found")
    return description


def get_database() -> list[dict]:
    return get_database_entries()


def get_latest_diagram_for_process(process_id: str, db: Session, analyst: User) -> dict:
    _ensure_process_owned(db, process_id, analyst)

    thread_id = get_latest_thread_for_process(process_id)
    if not thread_id:
        raise HTTPException(status_code=404, detail="No generated BPMN model found for this process")

    xml = get_xml_content(f"{thread_id}.xml")
    if xml is None:
        raise HTTPException(status_code=404, detail="Generated BPMN XML not found")
    description = get_description_content(thread_id)

    return {"id": thread_id, "response": xml, "description": description}


def get_diagram_history_for_process(process_id: str, db: Session, analyst: User) -> dict:
    _ensure_process_owned(db, process_id, analyst)

    thread_ids = get_thread_history_for_process(process_id)
    if not thread_ids:
        raise HTTPException(status_code=404, detail="No generated BPMN model history found for this process")

    items = []
    for thread_id in thread_ids:
        xml = get_xml_content(f"{thread_id}.xml")
        if xml:
            items.append({"id": thread_id, "response": xml, "description": get_description_content(thread_id)})

    if not items:
        raise HTTPException(status_code=404, detail="Generated BPMN history XML not found")

    return {"items": items}


def clear_diagram_history_for_process(process_id: str, db: Session, analyst: User) -> dict:
    _ensure_process_owned(db, process_id, analyst)
    deleted_count = clear_history_for_process(process_id)
    return {"status": "cleared", "deleted": deleted_count}


def get_knowledge_options_for_update(process_id: str, thread_id: str, db: Session, analyst: User) -> dict:
    _ensure_process_owned(db, process_id, analyst)

    used_snapshots = get_thread_used_session_snapshots(thread_id)
    sessions = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.process_id == process_id,
            InterviewSession.status == "completed",
        )
        .order_by(InterviewSession.created_at.asc())
        .all()
    )
    for session in sessions:
        db.refresh(session)

    items = []
    for session in sessions:
        session_id = str(session.id)
        current_fingerprint = session_fingerprint(session)
        previous_fingerprint = used_snapshots.get(session_id)

        if previous_fingerprint is None:
            change_type = "new"
        elif previous_fingerprint != current_fingerprint:
            change_type = "changed"
        else:
            continue

        items.append(
            {
                "id": session_id,
                "expertEmail": session.expert.email if session.expert else None,
                "createdAt": session.created_at.isoformat() if session.created_at else None,
                "qaCount": len(session.qa_items or []),
                "changeType": change_type,
            }
        )

    return {
        "threadId": thread_id,
        "usedSessionIds": list(used_snapshots.keys()),
        "items": items,
    }


def get_session_options_for_generation(process_id: str, db: Session, analyst: User) -> dict:
    _ensure_process_owned(db, process_id, analyst)

    sessions = load_completed_sessions(
        db,
        process_id=process_id,
        selected_session_ids=None,
        newest_first=False,
    )

    items = []
    for session in sessions:
        items.append(
            {
                "id": str(session.id),
                "expertEmail": session.expert.email if session.expert else None,
                "createdAt": session.created_at.isoformat() if session.created_at else None,
                "qaCount": len(session.qa_items or []),
                "hasSummary": isinstance(getattr(session, "session_summary", None), dict),
            }
        )
    return {"items": items}


def create_diagram(req: BpmnCreateRequest, background_tasks: BackgroundTasks, db: Session, analyst: User) -> dict:
    if not req.inputString:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid string. Please provide a non-empty string.",
        )

    api_key = decrypt_openai_key(analyst.openai_api_key) if analyst.openai_api_key else None

    generation_input = req.inputString

    response = generate_response(generation_input, api_key=api_key)
    if response == "Error":
        raise HTTPException(status_code=500, detail="Error generating response")
    thread_id, xml = response

    background_tasks.add_task(
        generate_and_save_description_for_thread,
        thread_id,
        api_key=api_key,
        description_override=req.inputString,
    )

    if req.processId:
        _ensure_process_owned(db, req.processId, analyst)
        sessions = load_completed_sessions(
            db,
            process_id=req.processId,
            selected_session_ids=req.selectedSessionIds,
            newest_first=False,
        )
        snapshots = {str(session.id): session_fingerprint(session) for session in sessions}
        set_thread_used_session_snapshots(thread_id, req.processId, snapshots)
        set_latest_thread_for_process(req.processId, thread_id)
        append_thread_for_process(req.processId, thread_id)

    return {"id": thread_id, "response": xml}


def update_diagram(req: BpmnUpdateRequest, background_tasks: BackgroundTasks, db: Session, analyst: User) -> dict:
    if not req.id or not req.inputString:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request. Please provide the id and inputString.",
        )

    api_key = decrypt_openai_key(analyst.openai_api_key) if analyst.openai_api_key else None

    selected_ids: list[str] = []
    for item in (req.selectedSessionIds or []):
        value = str(item).strip()
        if value and value not in selected_ids:
            selected_ids.append(value)

    if len(selected_ids) > 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can select up to 4 interviews for a model update.",
        )

    selected_session_id_set = {item for item in selected_ids if item.strip()}
    update_input = req.inputString
    selected_context_chunks: list[str] = []
    selected_fingerprints: dict[str, str] = {}

    if req.processId and selected_ids:
        _ensure_process_owned(db, req.processId, analyst)
        role_map = _get_process_role_map(db, req.processId)
        selected_sessions_desc = load_completed_sessions(
            db,
            process_id=req.processId,
            selected_session_ids=selected_ids,
            newest_first=True,
        )
        raw_sessions = list(reversed(selected_sessions_desc))
        for session in raw_sessions:
            selected_context_chunks.append(
                serialize_session_context(
                    session,
                    expert_role=role_map.get(session.expert_id) or role_map.get(str(session.expert_id)),
                )
            )
            selected_fingerprints[str(session.id)] = session_fingerprint(session)

    analyst_inconsistency_instructions = (
        analyst_knowledge_instructions(db, req.processId, selected_session_id_set) if req.processId else []
    )

    generated_feedback = None
    if selected_context_chunks:
        generated_feedback = generate_feedback_description(
            thread_id=req.id,
            selected_session_contexts=selected_context_chunks,
            resolved_inconsistency_instructions=analyst_inconsistency_instructions,
            api_key=api_key,
        )
        update_input = (
            generated_feedback
            or "\n\n".join(
                [
                    req.inputString,
                    "Additional interview knowledge that must be incorporated:",
                    "\n\n".join(selected_context_chunks),
                ]
            )
        )

    if analyst_inconsistency_instructions:
        update_input = "\n\n".join(
            [
                update_input,
                "Analyst inconsistency instructions that must be respected:",
                "\n".join(f"- {item}" for item in analyst_inconsistency_instructions),
            ]
        )

    response = continue_thread(update_input, req.id, api_key=api_key)
    if response == "Error":
        raise HTTPException(status_code=500, detail="Error generating response")
    thread_id, xml = response

    if req.processId:
        _ensure_process_owned(db, req.processId, analyst)
        previous_snapshots = get_thread_used_session_snapshots(req.id)
        merged_snapshots = dict(previous_snapshots)
        merged_snapshots.update(selected_fingerprints)
        set_thread_used_session_snapshots(thread_id, req.processId, merged_snapshots)
        branch_history_for_process(req.processId, req.id, thread_id)

    background_tasks.add_task(
        generate_and_save_description_for_thread,
        thread_id,
        api_key=api_key,
    )

    return {
        "id": thread_id,
        "response": xml,
        "feedbackDescription": update_input,
        "autoGeneratedFeedback": bool(generated_feedback),
    }


def get_process_description(req: BpmnDescriptionRequest, db: Session, analyst: User) -> dict:
    process = _ensure_process_owned(db, req.processId, analyst)

    sessions_desc = load_completed_sessions(
        db,
        process_id=req.processId,
        selected_session_ids=req.selectedSessionIds,
        newest_first=True,
    )
    raw_sessions_desc, summary_sessions_desc = select_raw_and_summary_sessions(sessions_desc)
    selected_sessions = list(reversed(raw_sessions_desc + summary_sessions_desc))
    role_map = _get_process_role_map(db, req.processId)

    description = generate_process_description(
        analyst_api_key=analyst.openai_api_key,
        process=process,
        sessions=selected_sessions,
        role_map=role_map,
        inconsistency_guidance=analyst_knowledge_instructions(
            db,
            req.processId,
            {str(item) for item in (req.selectedSessionIds or []) if str(item).strip()},
        ),
    )
    return {"description": description}


def save_diagram(req: BpmnSaveRequest) -> str:
    if not req.id:
        raise HTTPException(status_code=400, detail="No id provided")
    save_xml_content(req.id, req.xml)
    return "File saved"


def delete_diagram(req: BpmnDeleteRequest) -> str:
    if not req.id:
        raise HTTPException(status_code=400, detail="No id provided")
    delete_entry_by_thread(req.id)
    return "File deleted"


def delete_bpmn_database() -> str:
    delete_database()
    return "Database cleared"
