"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    process_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("processes.id"), index=True)
    expert_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    protocol_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("protocol_versions.id"), index=True)

    current_step_index: Mapped[int] = mapped_column(Integer, default=0)
    round_number: Mapped[int] = mapped_column(Integer, default=1)

    pending_step_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pending_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    pending_step_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(String(30), default="protocol_created")  # protocol_created|active|paused|completed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    session_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    qa_items: Mapped[list["QAItem"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    process: Mapped["Process"] = relationship("Process")
    expert: Mapped["User"] = relationship("User")
    protocol_version: Mapped["ProtocolVersion"] = relationship("ProtocolVersion")

class QAItem(Base):
    __tablename__ = "qa_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), index=True)

    step_id: Mapped[str] = mapped_column(String(100))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["InterviewSession"] = relationship(back_populates="qa_items") # So that we can access the session from a QAItem
