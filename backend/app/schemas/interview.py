"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

class ProtocolCreateRequest(BaseModel): # When an analyst creates a protocol
    case_id: UUID
    round_number: int
    expert_email: EmailStr | None = None
    expert_id: UUID | None = None
    allow_llm_followup_if_no_scenario: bool = False

class StartSessionResponse(BaseModel):
    session_id: UUID


class InterviewCompletionEvaluationRequest(BaseModel):
    session_id: UUID
    interview_questions_understandable: str
    interview_relevant_to_role: str
    interview_helped_explain_part: str
    evaluation_motivation: str | None = None


class AnswerRequest(BaseModel): # Session and step are in the url path so not included here
    text: str
    step_id: str
    question: str

class NextQuestionResponse(BaseModel):
    done: bool # when done it includes a completion message
    step_id: str | None = None
    question: str | None = None
    message: str | None = None
    session_id: UUID | None = None
    process_id: UUID | None = None
    current_step_index: int | None = None

class QAItemOut(BaseModel):
    id: UUID
    step_id: str
    question: str
    answer: str
    created_at: datetime

    class Config:
        from_attributes = True # So Pydantic can read from SQLAlchemy models

class InterviewSessionOut(BaseModel):
    id: UUID
    process_id: UUID
    expert_id: UUID
    expert_email: str | None = None
    status: str
    current_step_index: int
    round_number: int | None = None
    created_at: datetime
    qa_items: list[QAItemOut]
    process_name: str | None = None
    interview_intro: str | None = None

    class Config:
        from_attributes = True
