"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserOut, TokenResponse, OpenAIKeyUpdate
from app.services.auth import service as auth

router = APIRouter()


@router.post("/register", response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    return auth.create_user(db, user_in)


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect email or password")
    token = auth.create_token_for_user(user)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/experts", response_model=list[UserOut])
def list_experts(db: Session = Depends(get_db), _: User = Depends(auth.require_role(UserRole.analyst))):
    users = auth.get_active_experts(db)
    return [UserOut.model_validate(u) for u in users]


@router.put("/openai-key")
def update_openai_key(
    req: OpenAIKeyUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(auth.get_current_user),
):
    auth.update_openai_key_for_user(db, user, req.openai_api_key)
    return {"status": "saved"}


@router.get("/openai-key")
def get_openai_key_status(user: User = Depends(auth.get_current_user)):
    return {"has_key": auth.user_has_openai_key(user)}


@router.delete("/openai-key")
def delete_openai_key(db: Session = Depends(get_db), user: User = Depends(auth.get_current_user)):
    auth.update_openai_key_for_user(db, user, None)
    return {"status": "deleted"}
