"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from app.models.protocol import ProtocolStatus


class ProtocolDraftRead(BaseModel):
    id: UUID
    process_id: UUID
    expert_id: UUID
    round_number: int
    status: ProtocolStatus
    content: dict
    updated_at: datetime
    created_by_id: UUID

    class Config:
        from_attributes = True


class ProtocolDraftUpsert(BaseModel): # To save or update a draft
    process_id: UUID
    expert_id: UUID
    round_number: int
    content: dict


class ProtocolFeedbackRequest(BaseModel):
    process_id: UUID
    expert_id: UUID
    round_number: int
    feedback: str
    category: str | None = None
    length: str | None = None
    followup_count: int | None = None
    additional_info: str | None = None


class ProtocolGenerationEvaluationRequest(BaseModel):
    process_id: UUID
    expert_id: UUID
    round_number: int
    role_relevance: str
    follow_up_quality: str
    building: str
    ready_for_use: str
    evaluation_motivation: str | None = None


class ProtocolFeedbackEvaluationRequest(BaseModel):
    process_id: UUID
    expert_id: UUID
    round_number: int
    feedback_incorporated_adequately: str
    evaluation_motivation: str | None = None



