"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings # Importing settings from config.py

engine = create_engine(settings.database_url, pool_pre_ping=True) # Pool pre pring to avoid stale connections
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False) # Factory for sessions, autocmmit disabled so we can rollback or commit

def get_db():
    db = SessionLocal()
    try:
        yield db # Yield is ideal for generators as yield remembers state between calls and cleanup is ran
    finally:
        db.close()
