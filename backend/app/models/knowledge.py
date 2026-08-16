"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Table, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


interview_inconsistency_sessions = Table(
    "interview_inconsistency_sessions",
    Base.metadata,
    Column("inconsistency_id", UUID(as_uuid=True), ForeignKey("interview_inconsistencies.id", ondelete="CASCADE"), primary_key=True),
    Column("session_id", UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), primary_key=True),
)


interview_knowledge_gap_sessions = Table(
    "interview_knowledge_gap_sessions",
    Base.metadata,
    Column("gap_id", UUID(as_uuid=True), ForeignKey("interview_knowledge_gaps.id", ondelete="CASCADE"), primary_key=True),
    Column("session_id", UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), primary_key=True),
)


class InterviewInconsistency(Base):
    __tablename__ = "interview_inconsistencies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    process_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("processes.id"), index=True)
    signature: Mapped[str] = mapped_column(String(256), index=True)
    analyst_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=True)

    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list[str]] = mapped_column(JSONB, default=list)
    analyst_input: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="unresolved")  # unresolved|resolved|ignored

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    linked_sessions: Mapped[list["InterviewSession"]] = relationship(
        "InterviewSession",
        secondary=interview_inconsistency_sessions,
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_inconsistency_unique", "process_id", "signature", unique=True),
    )

    @property
    def linked_session_ids(self) -> list[str]:
        return [str(session.id) for session in self.linked_sessions or []]

    @linked_session_ids.setter
    def linked_session_ids(self, values: list[str] | None) -> None:
        raise AttributeError("linked_session_ids is read-only; assign linked_sessions instead")


class InterviewKnowledgeGap(Base):
    __tablename__ = "interview_knowledge_gaps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    process_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("processes.id"), index=True)
    signature: Mapped[str] = mapped_column(String(256), index=True)
    analyst_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=True)

    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list[str]] = mapped_column(JSONB, default=list)
    analyst_input: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="unresolved")  # unresolved|resolved|ignored

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    linked_sessions: Mapped[list["InterviewSession"]] = relationship(
        "InterviewSession",
        secondary=interview_knowledge_gap_sessions,
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_knowledge_gap_unique", "process_id", "signature", unique=True),
    )

    @property
    def linked_session_ids(self) -> list[str]:
        return [str(session.id) for session in self.linked_sessions or []]

    @linked_session_ids.setter
    def linked_session_ids(self, values: list[str] | None) -> None:
        raise AttributeError("linked_session_ids is read-only; assign linked_sessions instead")
