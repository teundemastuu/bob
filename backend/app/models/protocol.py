"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""
import uuid
import enum
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class ProtocolStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class ProtocolVersion(Base):
    __tablename__ = "protocol_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    process_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("processes.id"), index=True)
    expert_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    round_number: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[ProtocolStatus] = mapped_column(Enum(ProtocolStatus, name="protocol_status"))
    content: Mapped[dict] = mapped_column(JSONB) # The actual protocol content as JSON
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    published_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by = relationship("User", foreign_keys=[created_by_id])
    published_by = relationship("User", foreign_keys=[published_by_id])
    expert = relationship("User", foreign_keys=[expert_id])

    __table_args__ = (
        Index("ix_protocol_unique", "process_id", "round_number", "expert_id", "status", unique=True),
        Index("ix_protocol_lookup", "process_id", "expert_id", "round_number", "status"),
    )