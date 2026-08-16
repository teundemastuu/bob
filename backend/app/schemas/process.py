"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class UserBasic(BaseModel):
    id: UUID
    email: str
    
    class Config:
        from_attributes = True

class ProcessExpertAssignment(BaseModel):
    expert_id: UUID
    role: str


class ProcessCreate(BaseModel):
    name: str
    description: str
    expert_assignments: list[ProcessExpertAssignment]

class ProcessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    # expert_assignments removed: updates to expert assignments are not supported
    # via the current frontend edit flow.


class ProcessExpertOut(BaseModel):
    id: UUID
    email: str
    role: Optional[str] = None

    class Config:
        from_attributes = True

class ProcessOut(BaseModel):
    id: UUID
    name: str
    description: str
    created_by_id: UUID
    created_at: datetime
    expert_ids: list[UUID]
    experts: Optional[list[ProcessExpertOut]] = None
    created_by: Optional[UserBasic] = None
    protocol_creatable: bool = False

    class Config:
        from_attributes = True
