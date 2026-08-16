"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from uuid import UUID
from typing import Dict

from sqlalchemy.orm import Session
from sqlalchemy import delete, select
from fastapi import HTTPException

from app.models.process import Process, process_experts
from app.models.interview import InterviewSession, QAItem
from app.models.protocol import ProtocolVersion
from app.models.knowledge import InterviewInconsistency, InterviewKnowledgeGap
from app.models.user import User, UserRole
from app.schemas.process import ProcessCreate, ProcessUpdate, ProcessOut


def _get_role_map(db: Session, process_id: UUID) -> dict:
    rows = db.execute(
        process_experts.select().with_only_columns(
            process_experts.c.expert_id, process_experts.c.role
        ).where(process_experts.c.process_id == process_id)
    ).fetchall()
    return {row.expert_id: row.role for row in rows}


def _build_process_out(db: Session, process: Process, role_map: Dict) -> ProcessOut:
    process_sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.process_id == process.id)
        .all()
    )
    sessions_by_expert: dict[UUID, list[InterviewSession]] = {}
    for session in process_sessions:
        sessions_by_expert.setdefault(session.expert_id, []).append(session)

    protocol_creatable = False
    for expert in process.experts:
        expert_sessions = sessions_by_expert.get(expert.id, [])
        has_protocol_created = any(s.status == "protocol_created" for s in expert_sessions)
        has_active_or_paused = any(s.status in {"active", "paused"} for s in expert_sessions)
        highest_round = max((s.round_number or 1) for s in expert_sessions) if expert_sessions else 0
        highest_completed_round = (
            max((s.round_number or 1) for s in expert_sessions if s.status == "completed")
            if any(s.status == "completed" for s in expert_sessions)
            else 0
        )

        can_create_for_expert = (
            not has_active_or_paused
            and not has_protocol_created
            and (highest_round == 0 or highest_completed_round == highest_round)
        )
        if can_create_for_expert:
            protocol_creatable = True
            break

    return ProcessOut(
        id=process.id,
        name=process.name,
        description=process.description,
        created_by_id=process.created_by_id,
        created_at=process.created_at,
        expert_ids=[e.id for e in process.experts],
        experts=[{"id": e.id, "email": e.email, "role": role_map.get(e.id)} for e in process.experts],
        created_by={"id": process.created_by.id, "email": process.created_by.email},
        protocol_creatable=protocol_creatable,
    )


def create_process(db: Session, process_in: ProcessCreate, analyst: User):
    expert_ids = [a.expert_id for a in process_in.expert_assignments]
    experts = db.query(User).filter(User.id.in_(expert_ids), User.role == UserRole.expert).all()
    if len(experts) != len(expert_ids):
        raise HTTPException(status_code=400, detail="One or more expert IDs are invalid")

    process = Process(
        name=process_in.name,
        description=process_in.description,
        created_by_id=analyst.id,
    )
    db.add(process)
    db.commit()
    db.refresh(process)

    for assignment in process_in.expert_assignments:
        db.execute(
            process_experts.insert().values(
                process_id=process.id,
                expert_id=assignment.expert_id,
                role=assignment.role,
            )
        )
    db.commit()
    db.refresh(process)

    role_map = _get_role_map(db, process.id)
    return _build_process_out(db, process, role_map)


def list_processes(db: Session, analyst: User):
    processes = db.query(Process).filter(Process.created_by_id == analyst.id).order_by(Process.created_at.desc()).all()
    result = []
    for p in processes:
        role_map = _get_role_map(db, p.id)
        result.append(_build_process_out(db, p, role_map))
    return result


def get_process(db: Session, process_id: str, analyst: User):
    process = db.get(Process, process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.created_by_id != analyst.id:
        raise HTTPException(status_code=403, detail="Not your process")

    role_map = _get_role_map(db, process.id)
    return _build_process_out(db, process, role_map)


def delete_process(db: Session, process_id: str, analyst: User):
    process = db.get(Process, process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.created_by_id != analyst.id:
        raise HTTPException(status_code=403, detail="Not your process")

    session_ids_subquery = select(InterviewSession.id).where(InterviewSession.process_id == process_id)
    db.execute(delete(QAItem).where(QAItem.session_id.in_(session_ids_subquery)))
    db.execute(delete(InterviewSession).where(InterviewSession.process_id == process_id))
    db.execute(delete(ProtocolVersion).where(ProtocolVersion.process_id == process_id))
    db.execute(delete(InterviewInconsistency).where(InterviewInconsistency.process_id == process_id))
    db.execute(delete(InterviewKnowledgeGap).where(InterviewKnowledgeGap.process_id == process_id))
    db.execute(delete(process_experts).where(process_experts.c.process_id == process_id))

    db.delete(process)
    db.commit()
    return {"status": "deleted"}


def update_process(db: Session, process_id: str, process_update: ProcessUpdate, analyst: User):
    process = db.get(Process, process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.created_by_id != analyst.id:
        raise HTTPException(status_code=403, detail="Not your process")

    if process_update.name is not None:
        process.name = process_update.name
    if process_update.description is not None:
        process.description = process_update.description

    db.commit()
    db.refresh(process)

    role_map = _get_role_map(db, process.id)
    return _build_process_out(db, process, role_map)
