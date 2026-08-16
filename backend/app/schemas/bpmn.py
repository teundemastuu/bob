"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from pydantic import BaseModel
from typing import Optional


class BpmnCreateRequest(BaseModel):
    inputString: str
    processId: Optional[str] = None
    selectedSessionIds: list[str] = []


class BpmnUpdateRequest(BaseModel):
    id: str
    inputString: str
    processId: Optional[str] = None
    selectedSessionIds: list[str] = []


class BpmnDescriptionRequest(BaseModel):
    processId: str
    selectedSessionIds: list[str] = []


class BpmnSaveRequest(BaseModel):
    id: str
    xml: str


class BpmnDeleteRequest(BaseModel):
    id: str
