"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey, Table, Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

# Association table for many-to-many relationship between processes and experts
process_experts = Table(
    'process_experts',
    Base.metadata,
    Column('process_id', UUID(as_uuid=True), ForeignKey('processes.id'), primary_key=True),
    Column('expert_id', UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True),
    Column('role', String(50), nullable=False, default='member'),
)

class Process(Base):
    __tablename__ = "processes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str] = mapped_column(Text)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id]) # Not a database_column
    experts: Mapped[list["User"]] = relationship(
        "User",
        secondary=process_experts,
    )
