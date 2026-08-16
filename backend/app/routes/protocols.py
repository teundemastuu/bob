"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models.process import Process
from app.models.user import User
from app.models.protocol import ProtocolVersion, ProtocolStatus
from app.models.user import UserRole
from app.schemas.protocol import (
    ProtocolDraftRead,
    ProtocolDraftUpsert,
    ProtocolFeedbackRequest,
    ProtocolGenerationEvaluationRequest,
    ProtocolFeedbackEvaluationRequest,
)
from app.schemas.interview import ProtocolCreateRequest, StartSessionResponse
from app.services.protocol import service as protocol
from app.services.protocol.evaluation import (
    save_protocol_generation_evaluation as save_generation_evaluation,
    save_protocol_feedback_evaluation as save_feedback_evaluation,
)
from app.services.auth.service import require_role

router = APIRouter()


def _latest_protocol(
    db: Session, process_id: UUID, round_number: int, status: ProtocolStatus, expert_id: UUID
) -> ProtocolVersion | None:
    return (
        db.query(ProtocolVersion)
        .filter(
            ProtocolVersion.process_id == process_id,
            ProtocolVersion.round_number == round_number,
            ProtocolVersion.status == status,
            ProtocolVersion.expert_id == expert_id,
        )
        .order_by(ProtocolVersion.updated_at.desc())
        .first()
    )


@router.get("/protocols/draft", response_model=ProtocolDraftRead)
def get_protocol_draft(
    request: Request,
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
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    raw_selected_inconsistency_ids = [value for value in request.query_params.getlist("selected_inconsistency_ids") if value]
    raw_selected_gap_ids = [value for value in request.query_params.getlist("selected_gap_ids") if value]
    draft = _latest_protocol(db, process_id, round_number, ProtocolStatus.draft, expert_id)
    has_selection_params = bool(raw_selected_inconsistency_ids or raw_selected_gap_ids)
    if draft:
        if only_existing or not has_selection_params:
            return draft

    if only_existing:
        raise HTTPException(status_code=404, detail="Draft not found")

    return protocol.get_protocol_draft(
        db=db,
        process_id=process_id,
        expert_id=expert_id,
        round_number=round_number,
        category=category,
        length=length,
        followup_count=followup_count,
        additional_info=additional_info,
        selected_inconsistency_ids=raw_selected_inconsistency_ids,
        selected_gap_ids=raw_selected_gap_ids,
        selected_bpmn_thread_id=selected_bpmn_thread_id,
        only_existing=only_existing,
        analyst=analyst,
    )


@router.put("/protocols/draft", response_model=ProtocolDraftRead)
def upsert_protocol_draft(
    req: ProtocolDraftUpsert,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    process = db.get(Process, req.process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.created_by_id != analyst.id:
        raise HTTPException(status_code=403, detail="Not your process")

    return protocol.upsert_protocol_draft(req, db, analyst)


@router.delete("/protocols/draft")
def discard_protocol_draft(
    process_id: UUID,
    expert_id: UUID,
    round_number: int = 1,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return protocol.discard_protocol_draft(process_id, expert_id, round_number, db)


@router.post("/protocols/draft/feedback", response_model=ProtocolDraftRead)
def apply_protocol_feedback(
    req: ProtocolFeedbackRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return protocol.apply_protocol_feedback(req, db, analyst)


@router.post("/sessions/protocol-create", response_model=StartSessionResponse)
def create_protocol_session(
    req: ProtocolCreateRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    session = protocol.create_protocol_session(req, db, analyst)
    return StartSessionResponse(session_id=session.id)


@router.post("/protocols/generation-evaluation")
def save_protocol_generation_evaluation(
    req: ProtocolGenerationEvaluationRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return save_generation_evaluation(req, db, analyst)


@router.post("/protocols/feedback-evaluation")
def save_protocol_feedback_evaluation(
    req: ProtocolFeedbackEvaluationRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return save_feedback_evaluation(req, db, analyst)
