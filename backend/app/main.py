"""
First build with GitHub Copilot and then refactored by Teun de Mast.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.interview import router as interview_router
from app.routes.protocols import router as protocols_router
from app.routes.knowledge import router as knowledge_router
from app.routes.auth import router as auth_router
from app.routes.processes import router as processes_router
from app.routes.bpmn import router as bpmn_router
from app.db.session import engine
from app.db.base import Base
# Imported for their side effect: registering the SQLAlchemy models on Base.metadata
from app.models import interview  # noqa: F401
from app.models import user  # noqa: F401
from app.models import process  # noqa: F401
from app.models import knowledge  # noqa: F401

app = FastAPI(title="BOB")

app.add_middleware(
    CORSMiddleware,
    # Allow browsers on the local network to access the API.
    # In production you may want to restrict this to specific origins.
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine) # Create PostgreSQL tables if they do not exist

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(processes_router, tags=["processes"])
app.include_router(interview_router, tags=["interview"])  # interview/session lifecycle endpoints
app.include_router(protocols_router, tags=["protocols"])  # protocol draft/feedback/publish
app.include_router(knowledge_router, tags=["knowledge"])  # knowledge/inconsistency endpoints
app.include_router(bpmn_router, tags=["bpmn"])
