"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.bpmn import (
    BpmnCreateRequest,
    BpmnDescriptionRequest,
    BpmnDeleteRequest,
    BpmnSaveRequest,
    BpmnUpdateRequest,
)
from app.services.auth.service import require_role
from app.services.bpmn_chatbot import service as bpmn

router = APIRouter()


@router.get("/bpmn/data/xml/{filename}")
def get_xml_file(filename: str, analyst: User = Depends(require_role(UserRole.analyst))):
    return bpmn.get_xml_file(filename)


@router.get("/bpmn/data/description/{thread_id}")
def get_description_file(thread_id: str, analyst: User = Depends(require_role(UserRole.analyst))):
    return bpmn.get_description_file(thread_id)


@router.get("/bpmn/database")
def get_database(analyst: User = Depends(require_role(UserRole.analyst))):
    return bpmn.get_database()


@router.get("/bpmn/latest")
def get_latest_diagram_for_process(
    process_id: str,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return bpmn.get_latest_diagram_for_process(process_id, db, analyst)


@router.get("/bpmn/history")
def get_diagram_history_for_process(
    process_id: str,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return bpmn.get_diagram_history_for_process(process_id, db, analyst)


@router.delete("/bpmn/history")
def clear_diagram_history_for_process(
    process_id: str,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return bpmn.clear_diagram_history_for_process(process_id, db, analyst)


@router.get("/bpmn/knowledge-options")
def get_knowledge_options_for_update(
    process_id: str,
    thread_id: str,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return bpmn.get_knowledge_options_for_update(process_id, thread_id, db, analyst)


@router.get("/bpmn/session-options")
def get_session_options_for_generation(
    process_id: str,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return bpmn.get_session_options_for_generation(process_id, db, analyst)


@router.post("/bpmn/create")
def create_diagram(
    req: BpmnCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return bpmn.create_diagram(req, background_tasks, db, analyst)


@router.post("/bpmn/update")
def update_diagram(
    req: BpmnUpdateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return bpmn.update_diagram(req, background_tasks, db, analyst)


@router.post("/bpmn/description")
def get_process_description(
    req: BpmnDescriptionRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return bpmn.get_process_description(req, db, analyst)


@router.post("/bpmn/save")
def save_diagram(req: BpmnSaveRequest, analyst: User = Depends(require_role(UserRole.analyst))):
    return bpmn.save_diagram(req)


@router.post("/bpmn/delete")
def delete_diagram(req: BpmnDeleteRequest, analyst: User = Depends(require_role(UserRole.analyst))):
    return bpmn.delete_diagram(req)


@router.delete("/bpmn/delete-database")
def delete_bpmn_database(analyst: User = Depends(require_role(UserRole.analyst))):
    return bpmn.delete_bpmn_database()
