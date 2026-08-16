"""Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from __future__ import annotations

from datetime import datetime
import csv
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.process import Process
from app.models.user import User
from app.schemas.protocol import ProtocolGenerationEvaluationRequest, ProtocolFeedbackEvaluationRequest


def save_protocol_generation_evaluation(
    req: ProtocolGenerationEvaluationRequest,
    db: Session,
    analyst: User,
) -> dict:
    process = db.get(Process, req.process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.created_by_id != analyst.id:
        raise HTTPException(status_code=403, detail="Not your process")

    allowed_values = {
        "1 Strongly Disagree",
        "2 Disagree",
        "3 Neutral",
        "4 Agree",
        "5 Strongly Agree",
        "na",
    }

    if (
        req.role_relevance not in allowed_values
        or req.follow_up_quality not in allowed_values
        or req.building not in allowed_values
        or req.ready_for_use not in allowed_values
    ):
        raise HTTPException(status_code=400, detail="Ratings must match the selected options")

    csv_path = Path(__file__).resolve().parents[2] / "evaluation_data" / "protocol_generation_evaluations.csv"
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = csv_path.exists()

    with csv_path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow([
                "timestamp_utc",
                "analyst_id",
                "process_id",
                "expert_id",
                "round_number",
                "role_relevance",
                "follow_up_quality",
                "building",
                "ready_for_use",
                "evaluation_motivation",
            ])
        writer.writerow([
            datetime.utcnow().isoformat(),
            str(analyst.id),
            str(req.process_id),
            str(req.expert_id),
            req.round_number,
            req.role_relevance,
            req.follow_up_quality,
            req.building,
            req.ready_for_use,
            req.evaluation_motivation or "",
        ])

    return {"ok": True}


def save_protocol_feedback_evaluation(
    req: ProtocolFeedbackEvaluationRequest,
    db: Session,
    analyst: User,
) -> dict:
    process = db.get(Process, req.process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.created_by_id != analyst.id:
        raise HTTPException(status_code=403, detail="Not your process")

    allowed_values = {
        "1 Strongly Disagree",
        "2 Disagree",
        "3 Neutral",
        "4 Agree",
        "5 Strongly Agree",
        "na",
    }

    if req.feedback_incorporated_adequately not in allowed_values:
        raise HTTPException(status_code=400, detail="Rating must match the selected options")

    csv_path = Path(__file__).resolve().parents[2] / "evaluation_data" / "protocol_feedback_evaluations.csv"
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = csv_path.exists()

    with csv_path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow([
                "timestamp_utc",
                "analyst_id",
                "process_id",
                "expert_id",
                "round_number",
                "feedback_incorporated_adequately",
                "evaluation_motivation",
            ])
        writer.writerow([
            datetime.utcnow().isoformat(),
            str(analyst.id),
            str(req.process_id),
            str(req.expert_id),
            req.round_number,
            req.feedback_incorporated_adequately,
            req.evaluation_motivation or "",
        ])

    return {"ok": True}