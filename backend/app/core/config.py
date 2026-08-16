"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from pydantic_settings import BaseSettings

class Settings(BaseSettings): # We use pydantic instead of importing env files to ensure type validation and required fields 
    database_url: str
    openai_model: str = "gpt-5o-mini"
    secret_key: str

    class Config:
        env_file = ".env"

settings = Settings()
