"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID


class InconsistencyItem(BaseModel):
    id: str
    title: str
    description: str
    evidence: list[str] = Field(default_factory=list)
    is_new: bool = False
    status: str = "unresolved"
    resolved: bool = False
    ignored: bool = False
    analyst_input: str | None = None
    resolved_at: datetime | None = None


class DetectInconsistenciesRequest(BaseModel):
    process_id: UUID


class DetectInconsistenciesResponse(BaseModel):
    process_id: UUID
    items: list[InconsistencyItem]


class ResolveInconsistencyRequest(BaseModel):
    process_id: UUID
    inconsistency_id: str
    title: str
    description: str
    evidence: list[str] = Field(default_factory=list)
    analyst_input: str = Field(min_length=1, max_length=4000)


class ResolveInconsistencyResponse(BaseModel):
    process_id: UUID
    item: InconsistencyItem


class IgnoreInconsistencyRequest(BaseModel):
    process_id: UUID
    inconsistency_id: str


class IgnoreInconsistencyResponse(BaseModel):
    process_id: UUID
    inconsistency_id: str
    ignored: bool = True


class UnignoreInconsistencyRequest(BaseModel):
    process_id: UUID
    inconsistency_id: str


class UnignoreInconsistencyResponse(BaseModel):
    process_id: UUID
    inconsistency_id: str
    ignored: bool = False


class KnowledgeGapItem(BaseModel):
    id: str
    title: str
    description: str
    evidence: list[str] = Field(default_factory=list)
    is_new: bool = False
    status: str = "unresolved"
    resolved: bool = False
    ignored: bool = False
    analyst_input: str | None = None
    resolved_at: datetime | None = None


class DetectKnowledgeGapsRequest(BaseModel):
    process_id: UUID


class DetectKnowledgeGapsResponse(BaseModel):
    process_id: UUID
    items: list[KnowledgeGapItem]


class ResolveKnowledgeGapRequest(BaseModel):
    process_id: UUID
    gap_id: str
    title: str
    description: str
    evidence: list[str] = Field(default_factory=list)
    analyst_input: str = Field(min_length=1, max_length=4000)


class ResolveKnowledgeGapResponse(BaseModel):
    process_id: UUID
    item: KnowledgeGapItem


class IgnoreKnowledgeGapRequest(BaseModel):
    process_id: UUID
    gap_id: str


class IgnoreKnowledgeGapResponse(BaseModel):
    process_id: UUID
    gap_id: str
    ignored: bool = True


class UnignoreKnowledgeGapRequest(BaseModel):
    process_id: UUID
    gap_id: str


class UnignoreKnowledgeGapResponse(BaseModel):
    process_id: UUID
    gap_id: str
    ignored: bool = False
