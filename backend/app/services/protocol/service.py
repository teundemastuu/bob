"""Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""


from datetime import datetime
from sqlalchemy.orm import Session
from uuid import UUID
from fastapi import HTTPException

from app.models.process import Process
from app.models.user import User as UserModel
from app.models.protocol import ProtocolVersion, ProtocolStatus
from app.models.user import UserRole as UserRoleEnum
from app.services.protocol.loader import (
    generate_protocol,
    generate_protocol_from_feedback,
)


def get_protocol_draft(
    db: Session,
    process_id: UUID,
    expert_id: UUID,
    round_number: int = 1,
    category: str | None = None,
    length: str | None = None,
    followup_count: int | None = None,
    additional_info: str | None = None,
    selected_inconsistency_ids: list[str] | None = None,
    selected_gap_ids: list[str] | None = None,
    selected_bpmn_thread_id: str | None = None,
    only_existing: bool = False,
    analyst: UserModel | None = None,
):
    draft = (
        db.query(ProtocolVersion)
        .filter(
            ProtocolVersion.process_id == process_id,
            ProtocolVersion.round_number == round_number,
            ProtocolVersion.status == ProtocolStatus.draft,
            ProtocolVersion.expert_id == expert_id,
        )
        .order_by(ProtocolVersion.updated_at.desc())
        .first()
    )
    if draft:
        return draft

    if only_existing:
        raise HTTPException(status_code=404, detail="Draft not found")

    if analyst is None:
        raise HTTPException(status_code=400, detail="Analyst required for generation")

    content = generate_protocol(
        process_id=process_id,
        expert_id=expert_id,
        round_number=round_number,
        db=db,
        analyst=analyst,
        category=category,
        length=length,
        followup_count=followup_count,
        additional_info=additional_info,
        selected_inconsistency_ids=selected_inconsistency_ids,
        selected_gap_ids=selected_gap_ids,
        selected_bpmn_thread_id=selected_bpmn_thread_id,
    )
    draft = ProtocolVersion(
        process_id=process_id,
        expert_id=expert_id,
        round_number=round_number,
        status=ProtocolStatus.draft,
        content=content,
        created_by_id=analyst.id,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


def upsert_protocol_draft(req, db: Session, analyst: UserModel):
    # For the manual edits of the analyst
    process = db.get(Process, req.process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.created_by_id != analyst.id:
        raise HTTPException(status_code=403, detail="Not your process")

    latest = (
        db.query(ProtocolVersion)
        .filter(
            ProtocolVersion.process_id == req.process_id,
            ProtocolVersion.round_number == req.round_number,
            ProtocolVersion.status == ProtocolStatus.draft,
            ProtocolVersion.expert_id == req.expert_id,
        )
        .order_by(ProtocolVersion.updated_at.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="Draft not found")

    latest.content = req.content
    latest.created_by_id = analyst.id
    draft = latest
    db.commit()
    db.refresh(draft)
    return draft


def discard_protocol_draft(process_id: UUID, expert_id: UUID, round_number: int, db: Session):
    deleted = (
        db.query(ProtocolVersion)
        .filter(
            ProtocolVersion.process_id == process_id,
            ProtocolVersion.expert_id == expert_id,
            ProtocolVersion.round_number == round_number,
            ProtocolVersion.status == ProtocolStatus.draft,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted}


def apply_protocol_feedback(req, db: Session, analyst: UserModel):
    # when the analyst provides textual feedback
    latest = (
        db.query(ProtocolVersion)
        .filter(
            ProtocolVersion.process_id == req.process_id,
            ProtocolVersion.expert_id == req.expert_id,
            ProtocolVersion.round_number == req.round_number,
            ProtocolVersion.status == ProtocolStatus.draft,
        )
        .order_by(ProtocolVersion.updated_at.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="Draft not found")

    new_content = generate_protocol_from_feedback(
        process_id=req.process_id,
        expert_id=req.expert_id,
        round_number=req.round_number,
        db=db,
        analyst=analyst,
        base_protocol=latest.content,
        feedback=req.feedback,
        category=req.category,
        length=req.length,
        followup_count=req.followup_count,
        additional_info=req.additional_info,
    )

    latest.content = new_content
    latest.created_by_id = analyst.id
    draft = latest
    db.commit()
    db.refresh(draft)
    return draft


def create_protocol_session(req, db: Session, analyst: UserModel):
    # when a protocol i spublished 
    process = db.get(Process, req.case_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.created_by_id != analyst.id:
        raise HTTPException(status_code=403, detail="Not your process")

    if req.expert_email:
        expert = db.query(UserModel).filter(UserModel.email == req.expert_email, UserModel.role == UserRoleEnum.expert).first()
        if not expert:
            raise HTTPException(status_code=404, detail="Expert user not found")
        expert_id_value = expert.id
    elif req.expert_id:
        expert_id_value = req.expert_id
    else:
        raise HTTPException(status_code=400, detail="Provide expert_email or expert_id")

    round_number = req.round_number if req.round_number else 1

    draft = (
        db.query(ProtocolVersion)
        .filter(
            ProtocolVersion.process_id == process.id,
            ProtocolVersion.expert_id == expert_id_value,
            ProtocolVersion.round_number == round_number,
            ProtocolVersion.status == ProtocolStatus.draft,
        )
        .order_by(ProtocolVersion.updated_at.desc())
        .first()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found for publish")

    draft_content = draft.content if isinstance(draft.content, dict) else {}
    draft_content = dict(draft_content)
    settings = draft_content.get("settings") if isinstance(draft_content.get("settings"), dict) else {}
    settings = dict(settings)
    settings["allow_llm_followup_if_no_scenario"] = bool(req.allow_llm_followup_if_no_scenario)
    draft_content["settings"] = settings
    draft.content = draft_content

    db.query(ProtocolVersion).filter(
        ProtocolVersion.process_id == process.id,
        ProtocolVersion.expert_id == expert_id_value,
        ProtocolVersion.round_number == round_number,
        ProtocolVersion.status == ProtocolStatus.published,
    ).delete(synchronize_session=False)

    draft.status = ProtocolStatus.published
    draft.published_by_id = analyst.id
    draft.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(draft)

    from app.models.interview import InterviewSession

    session = InterviewSession(
        process_id=process.id,
        expert_id=expert_id_value,
        protocol_version_id=draft.id,
        round_number=round_number,
        status="protocol_created",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
