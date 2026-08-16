"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from datetime import datetime, timedelta, timezone
from typing import Optional
import os
import base64
import hashlib
from jose import jwt, JWTError
from passlib.context import CryptContext
from cryptography.fernet import Fernet

from app.core.config import settings

SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def _get_fernet_key() -> bytes:
    env_key = os.getenv("OPENAI_KEY_ENCRYPTION_KEY")
    if env_key:
        try:
            Fernet(env_key.encode("utf-8"))
            return env_key.encode("utf-8")
        except Exception:
            pass
    digest = hashlib.sha256(SECRET_KEY.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)

def encrypt_openai_key(plain: str) -> str:
    f = Fernet(_get_fernet_key())
    return f.encrypt(plain.encode("utf-8")).decode("utf-8")

def decrypt_openai_key(token: str) -> str:
    f = Fernet(_get_fernet_key())
    try:
        return f.decrypt(token.encode("utf-8")).decode("utf-8")
    except Exception:
        # Backward compatibility for previously stored plaintext keys
        return token

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str: 
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": subject, "exp": datetime.now(tz=timezone.utc) + expires_delta}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict | None: # To identify the user from the token and check its validity
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
