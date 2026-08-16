"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from enum import Enum

class UserRole(str, Enum):
    expert = "expert"
    analyst = "analyst"

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6) # Field to enforce minimum length
    role: UserRole
    name: str | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    name: str | None
    role: UserRole

    class Config:
        from_attributes = True

class TokenResponse(BaseModel): # Response after login
    access_token: str # Token that the client must send on every authenticated request
    token_type: str = "bearer"
    user: UserOut

class OpenAIKeyUpdate(BaseModel):
    openai_api_key: str = Field(min_length=1)
