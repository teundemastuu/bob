"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.schemas.interview import (
    StartSessionResponse,
    AnswerRequest,
    NextQuestionResponse,
    InterviewSessionOut,
    InterviewCompletionEvaluationRequest,
)
from app.services.interview import service as interview
from app.services.interview.evaluation import save_interview_completion_evaluation
from app.services.auth.service import require_role
from app.models.user import User, UserRole

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/sessions/{session_id}/activate", response_model=StartSessionResponse)
def activate_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    expert: User = Depends(require_role(UserRole.expert)),
):
    try:
        s = interview.activate_session(db, session_id, expert)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Not your session")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return StartSessionResponse(session_id=s.id)


@router.get("/sessions/my-sessions", response_model=list[InterviewSessionOut])
def get_my_sessions(
    db: Session = Depends(get_db),
    expert: User = Depends(require_role(UserRole.expert)),
):
    rows = interview.get_my_sessions(db, expert)
    return [InterviewSessionOut(**r) for r in rows]


@router.get("/sessions/{session_id}/next", response_model=NextQuestionResponse)
def next_question(
    session_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    expert: User = Depends(require_role(UserRole.expert)),
):
    try:
        resp, needs_summary = interview.next_question(db, session_id, expert)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Not your session")
    if resp is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if needs_summary:
        background_tasks.add_task(interview.summarize_completed_session_background, str(session_id))
    return NextQuestionResponse(**resp)


@router.post("/sessions/{session_id}/answer")
def answer(
    session_id: str,
    req: AnswerRequest,
    db: Session = Depends(get_db),
    expert: User = Depends(require_role(UserRole.expert)),
):
    try:
        result = interview.answer(db, session_id, req, expert)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Not your session")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if result is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/processes/{process_id}/sessions", response_model=list[InterviewSessionOut])
def get_process_sessions(
    process_id: UUID,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    try:
        rows = interview.get_process_sessions(db, process_id, analyst)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Not your process")
    if rows is None:
        raise HTTPException(status_code=404, detail="Process not found")
    return [InterviewSessionOut(**r) for r in rows]


@router.post("/sessions/{session_id}/pause")
def pause_session(
    session_id: str,
    db: Session = Depends(get_db),
    expert: User = Depends(require_role(UserRole.expert)),
):
    try:
        result = interview.pause_session(db, session_id, expert)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Not your session")
    if result is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.post("/sessions/completion-evaluation")
def save_completion_evaluation(
    req: InterviewCompletionEvaluationRequest,
    db: Session = Depends(get_db),
    expert: User = Depends(require_role(UserRole.expert)),
):
    return save_interview_completion_evaluation(req, db, expert)


