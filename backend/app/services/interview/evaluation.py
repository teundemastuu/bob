"""Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from __future__ import annotations

from datetime import datetime
import csv
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.interview import InterviewSession
from app.models.user import User
from app.schemas.interview import InterviewCompletionEvaluationRequest


def save_interview_completion_evaluation(
    req: InterviewCompletionEvaluationRequest,
    db: Session,
    expert: User,
) -> dict:
    session = db.get(InterviewSession, req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if str(session.expert_id) != str(expert.id):
        raise HTTPException(status_code=403, detail="Not your session")

    allowed_values = {
        "1 Strongly Disagree",
        "2 Disagree",
        "3 Neutral",
        "4 Agree",
        "5 Strongly Agree",
        "na",
    }

    for value in (
        req.interview_questions_understandable,
        req.interview_relevant_to_role,
        req.interview_helped_explain_part,
    ):
        if value not in allowed_values:
            raise HTTPException(status_code=400, detail="Rating must match the selected options")

    csv_path = Path(__file__).resolve().parents[2] / "evaluation_data" / "interview_completion_evaluations.csv"
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = csv_path.exists()

    with csv_path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow([
                "timestamp_utc",
                "expert_id",
                "session_id",
                "process_id",
                "round_number",
                "interview_questions_understandable",
                "interview_relevant_to_role",
                "interview_helped_explain_part",
                "evaluation_motivation",
            ])
        writer.writerow([
            datetime.utcnow().isoformat(),
            str(expert.id),
            str(session.id),
            str(session.process_id),
            session.round_number,
            req.interview_questions_understandable,
            req.interview_relevant_to_role,
            req.interview_helped_explain_part,
            req.evaluation_motivation or "",
        ])

    return {"ok": True}