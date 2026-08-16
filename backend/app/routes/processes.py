"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.process import ProcessCreate, ProcessUpdate, ProcessOut
from app.services.auth.service import require_role
from app.services.process import service as process

router = APIRouter()


@router.post("/processes", response_model=ProcessOut)
def create_process(
    process_in: ProcessCreate,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return process.create_process(db, process_in, analyst)


@router.get("/processes", response_model=list[ProcessOut])
def list_processes(
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return process.list_processes(db, analyst)


@router.get("/processes/{process_id}", response_model=ProcessOut)
def get_process(
    process_id: str,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return process.get_process(db, process_id, analyst)


@router.delete("/processes/{process_id}")
def delete_process(
    process_id: str,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return process.delete_process(db, process_id, analyst)


@router.put("/processes/{process_id}", response_model=ProcessOut)
def update_process(
    process_id: str,
    process_update: ProcessUpdate,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return process.update_process(db, process_id, process_update, analyst)
