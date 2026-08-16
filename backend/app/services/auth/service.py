"""Authentication service: encapsulates auth-related logic used by routes.

This module centralizes user creation, authentication, token handling and
OpenAI key persistence so routes stay thin and testable.
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserRole
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token,
    encrypt_openai_key,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
logger = logging.getLogger(__name__)


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def create_user(db: Session, user_in) -> User:
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(
        email=user_in.email,
        name=user_in.name,
        role=UserRole(user_in.role),
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_token_for_user(user: User) -> str:
    return create_access_token(subject=str(user.id))


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid subject in token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_role(role: UserRole) -> Callable:
    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return _checker


def get_active_experts(db: Session) -> list[User]:
    return db.query(User).filter(User.role == UserRole.expert, User.is_active == True).order_by(User.email.asc()).all()


def update_openai_key_for_user(db: Session, user: User, new_key: Optional[str]) -> None:
    user.openai_api_key = encrypt_openai_key(new_key) if new_key else None
    db.add(user)
    db.commit()


def user_has_openai_key(user: User) -> bool:
    return bool(user.openai_api_key)
