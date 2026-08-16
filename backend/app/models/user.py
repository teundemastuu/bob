"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Enum, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
import enum

class UserRole(str, enum.Enum): # Enum so the database enforces valid roles
    expert = "expert"
    analyst = "analyst"

class User(Base):
    __tablename__ = "users"
    # Mapped is SQLAlchemy's way of typing columns
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    openai_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)