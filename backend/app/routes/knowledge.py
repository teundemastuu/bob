"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.auth.service import require_role
from app.models.user import User, UserRole
from app.schemas.knowledge import (
    DetectInconsistenciesRequest,
    DetectInconsistenciesResponse,
    ResolveInconsistencyRequest,
    ResolveInconsistencyResponse,
    IgnoreInconsistencyRequest,
    IgnoreInconsistencyResponse,
    UnignoreInconsistencyRequest,
    UnignoreInconsistencyResponse,
    DetectKnowledgeGapsRequest,
    DetectKnowledgeGapsResponse,
    ResolveKnowledgeGapRequest,
    ResolveKnowledgeGapResponse,
    IgnoreKnowledgeGapRequest,
    IgnoreKnowledgeGapResponse,
    UnignoreKnowledgeGapRequest,
    UnignoreKnowledgeGapResponse,
)
from app.services.knowledge.knowledge_inconsistency import (
    detect_and_store_inconsistencies,
    list_inconsistencies,
    resolve_inconsistency as resolve_inconsistency_service,
    ignore_inconsistency as ignore_inconsistency_service,
    unignore_inconsistency as unignore_inconsistency_service,
)
from app.services.knowledge.knowledge_gap import (
    detect_and_store_knowledge_gaps,
    list_knowledge_gaps,
    resolve_knowledge_gap as resolve_knowledge_gap_service,
    ignore_knowledge_gap as ignore_knowledge_gap_service,
    unignore_knowledge_gap as unignore_knowledge_gap_service,
)

router = APIRouter()


@router.post("/knowledge/inconsistencies/detect", response_model=DetectInconsistenciesResponse)
def detect_knowledge_inconsistencies(
    req: DetectInconsistenciesRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return detect_and_store_inconsistencies(db, req, analyst)


@router.get("/knowledge/inconsistencies", response_model=DetectInconsistenciesResponse)
def get_knowledge_inconsistencies(
    process_id: UUID,
    show_resolved: bool = False,
    show_ignored: bool = False,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return list_inconsistencies(
        db,
        process_id,
        analyst,
        show_resolved=show_resolved,
        show_ignored=show_ignored,
    )


@router.post("/knowledge/inconsistencies/resolve", response_model=ResolveInconsistencyResponse)
def resolve_knowledge_inconsistency(
    req: ResolveInconsistencyRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return resolve_inconsistency_service(db, req, analyst)


@router.post("/knowledge/inconsistencies/ignore", response_model=IgnoreInconsistencyResponse)
def ignore_knowledge_inconsistency(
    req: IgnoreInconsistencyRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return ignore_inconsistency_service(db, req, analyst)


@router.post("/knowledge/inconsistencies/unignore", response_model=UnignoreInconsistencyResponse)
def unignore_knowledge_inconsistency(
    req: UnignoreInconsistencyRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return unignore_inconsistency_service(db, req, analyst)


@router.post("/knowledge/gaps/detect", response_model=DetectKnowledgeGapsResponse)
def detect_knowledge_gaps(
    req: DetectKnowledgeGapsRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return detect_and_store_knowledge_gaps(db, req, analyst)


@router.get("/knowledge/gaps", response_model=DetectKnowledgeGapsResponse)
def get_knowledge_gaps(
    process_id: UUID,
    show_resolved: bool = False,
    show_ignored: bool = False,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return list_knowledge_gaps(
        db,
        process_id,
        analyst,
        show_resolved=show_resolved,
        show_ignored=show_ignored,
    )


@router.post("/knowledge/gaps/resolve", response_model=ResolveKnowledgeGapResponse)
def resolve_knowledge_gap(
    req: ResolveKnowledgeGapRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return resolve_knowledge_gap_service(db, req, analyst)


@router.post("/knowledge/gaps/ignore", response_model=IgnoreKnowledgeGapResponse)
def ignore_knowledge_gap(
    req: IgnoreKnowledgeGapRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return ignore_knowledge_gap_service(db, req, analyst)


@router.post("/knowledge/gaps/unignore", response_model=UnignoreKnowledgeGapResponse)
def unignore_knowledge_gap(
    req: UnignoreKnowledgeGapRequest,
    db: Session = Depends(get_db),
    analyst: User = Depends(require_role(UserRole.analyst)),
):
    return unignore_knowledge_gap_service(db, req, analyst)
