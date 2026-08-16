"""LLM instructions made by Teun de Mast.
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.services.llm_client import call_openai
from app.models.knowledge import InterviewKnowledgeGap
from app.schemas.knowledge import (
    DetectKnowledgeGapsRequest,
    DetectKnowledgeGapsResponse,
    KnowledgeGapItem,
    ResolveKnowledgeGapRequest,
    ResolveKnowledgeGapResponse,
    IgnoreKnowledgeGapRequest,
    IgnoreKnowledgeGapResponse,
    UnignoreKnowledgeGapRequest,
    UnignoreKnowledgeGapResponse,
)
from .knowledge_common import (
    assert_process_owned,
    build_completed_sessions_payload,
    build_question_session_map,
    normalize_text,
    get_openai_api_key_or_error,
    linked_sessions_from_evidence_raw,
    load_linked_sessions,
)


LLM_KNOWLEDGE_GAP_INSTRUCTIONS_PATH = Path(__file__).resolve().parent / "llm_knowledge_gap_instructions.txt"


def _load_instructions() -> str:
    return LLM_KNOWLEDGE_GAP_INSTRUCTIONS_PATH.read_text(encoding="utf-8")

def _build_question_signature_token(entry) -> str | None:
    if not isinstance(entry, dict):
        return None

    question = normalize_text(str(entry.get("question") or ""))
    if not question:
        return None
    return f"question={question[:200]}"


def _normalize_gap_id(evidence: list) -> str:
    normalized_questions = sorted(
        {
            token
            for token in (_build_question_signature_token(item) for item in (evidence or []))
            if token
        }
    )
    signature_payload = {
        "questions": normalized_questions,
    }

    raw = json.dumps(
        signature_payload,
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _format_evidence_entry(entry) -> str | None:
    if isinstance(entry, dict):
        expert = str(entry.get("expert") or "").strip()
        role = str(entry.get("role") or entry.get("expert_role") or "").strip()
        question = str(entry.get("question") or "").strip()
        statement = str(entry.get("statement") or entry.get("text") or "").strip()
        if not statement:
            return None
        prefix_parts = []
        if expert:
            prefix_parts.append(f"Expert {expert}")
        else:
            prefix_parts.append("Expert unspecified")
        if role:
            prefix_parts.append(f"role {role}")
        if question:
            prefix_parts.append(f"Q: {question}")
        return f"{' · '.join(prefix_parts)}: {statement}"

    text = str(entry or "").strip()
    if not text:
        return None
    lower = text.lower()
    if "expert" in lower or "@" in text:
        return text
    return f"Expert unspecified: {text}"


def detect_knowledge_gaps(*, api_key: str, process_payload: dict, sessions_payload: list[dict]) -> list[dict]:
    instructions = _load_instructions()
    prompt = (
        f"{instructions}\n\n"
        f"process:\n{json.dumps(process_payload, ensure_ascii=False, indent=2)}\n\n"
        f"completed_interviews:\n{json.dumps(sessions_payload, ensure_ascii=False, indent=2)}"
    )
    result = call_openai(
        api_key,
        system=instructions,
        user=prompt,
        response_format="json_object",
    )
    raw_items = result.get("knowledge_gaps", [])
    if not isinstance(raw_items, list):
        return []

    normalized = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        description = str(item.get("description") or "").strip()
        evidence_raw = item.get("evidence") or []
        if not isinstance(evidence_raw, list):
            evidence_raw = [evidence_raw]
        evidence = [formatted for formatted in (_format_evidence_entry(e) for e in evidence_raw) if formatted]
        if not title or not description:
            continue

        item_id = _normalize_gap_id(evidence_raw)
        normalized.append(
            {
                "id": item_id,
                "title": title,
                "description": description,
                "evidence": evidence,
                "evidence_raw": evidence_raw,
            }
        )
    return normalized


def _knowledge_gap_item_from_row(row: InterviewKnowledgeGap, *, is_new: bool = False) -> KnowledgeGapItem:
    status_value = (row.status or "unresolved").strip().lower()
    return KnowledgeGapItem(
        id=row.signature,
        title=row.title,
        description=row.description,
        evidence=row.evidence or [],
        is_new=is_new,
        status=status_value,
        resolved=status_value == "resolved",
        ignored=status_value == "ignored",
        analyst_input=row.analyst_input,
        resolved_at=row.updated_at if status_value == "resolved" else None,
    )


def _load_visible_knowledge_gap_items(
    db: Session,
    process_id,
    *,
    show_resolved: bool = False,
    show_ignored: bool = False,
    new_ids: set[str] | None = None,
) -> list[KnowledgeGapItem]:
    statuses = ["unresolved"]
    if show_resolved:
        statuses.append("resolved")
    if show_ignored:
        statuses.append("ignored")

    rows = (
        db.query(InterviewKnowledgeGap)
        .filter(
            InterviewKnowledgeGap.process_id == process_id,
            InterviewKnowledgeGap.status.in_(statuses),
        )
        .order_by(InterviewKnowledgeGap.updated_at.desc())
        .all()
    )
    new_ids_set = new_ids or set()
    return [_knowledge_gap_item_from_row(row, is_new=row.signature in new_ids_set) for row in rows]


def detect_and_store_knowledge_gaps(
    db: Session,
    req: DetectKnowledgeGapsRequest,
    analyst,
) -> DetectKnowledgeGapsResponse:
    process = assert_process_owned(db, req.process_id, analyst)
    api_key = get_openai_api_key_or_error(analyst)
    process_payload, sessions_payload, _ = build_completed_sessions_payload(db, process)

    gaps = detect_knowledge_gaps(
        api_key=api_key,
        process_payload=process_payload,
        sessions_payload=sessions_payload,
    )

    question_session_map = build_question_session_map(sessions_payload)
    existing_rows = (
        db.query(InterviewKnowledgeGap)
        .filter(InterviewKnowledgeGap.process_id == req.process_id)
        .all()
    )
    existing_by_signature: dict[str, InterviewKnowledgeGap] = {row.signature: row for row in existing_rows}

    new_ids: set[str] = set()
    seen_signatures: set[str] = set()
    for gap in gaps:
        item_id = str(gap.get("id") or "").strip()
        if not item_id or item_id in seen_signatures:
            continue
        seen_signatures.add(item_id)

        evidence_raw = gap.get("evidence_raw") or []
        linked_session_ids = linked_sessions_from_evidence_raw(evidence_raw, question_session_map)
        linked_sessions = load_linked_sessions(db, linked_session_ids)
        row = existing_by_signature.get(item_id)
        if row:
            continue

        row = InterviewKnowledgeGap(
            process_id=req.process_id,
            signature=item_id,
            title=gap["title"],
            description=gap["description"],
            evidence=gap.get("evidence", []),
            status="unresolved",
        )
        row.linked_sessions = linked_sessions
        db.add(row)
        existing_by_signature[item_id] = row
        new_ids.add(item_id)

    db.commit()
    items = _load_visible_knowledge_gap_items(db, req.process_id, new_ids=new_ids)
    return DetectKnowledgeGapsResponse(process_id=req.process_id, items=items)


def list_knowledge_gaps(
    db: Session,
    process_id,
    analyst,
    *,
    show_resolved: bool = False,
    show_ignored: bool = False,
) -> DetectKnowledgeGapsResponse:
    assert_process_owned(db, process_id, analyst)
    items = _load_visible_knowledge_gap_items(
        db,
        process_id,
        show_resolved=show_resolved,
        show_ignored=show_ignored,
    )
    return DetectKnowledgeGapsResponse(process_id=process_id, items=items)


def resolve_knowledge_gap(
    db: Session,
    req: ResolveKnowledgeGapRequest,
    analyst,
) -> ResolveKnowledgeGapResponse:
    assert_process_owned(db, req.process_id, analyst)
    analyst_input = req.analyst_input.strip()

    existing = (
        db.query(InterviewKnowledgeGap)
        .filter(
            InterviewKnowledgeGap.process_id == req.process_id,
            InterviewKnowledgeGap.signature == req.gap_id,
        )
        .first()
    )

    if existing:
        existing.title = req.title
        existing.description = req.description
        existing.evidence = req.evidence
        existing.analyst_input = analyst_input
        existing.status = "resolved"
        existing.analyst_id = analyst.id
        row = existing
    else:
        row = InterviewKnowledgeGap(
            process_id=req.process_id,
            signature=req.gap_id,
            analyst_id=analyst.id,
            title=req.title,
            description=req.description,
            evidence=req.evidence,
            analyst_input=analyst_input,
            status="resolved",
        )
        db.add(row)

    db.commit()
    db.refresh(row)
    return ResolveKnowledgeGapResponse(process_id=req.process_id, item=_knowledge_gap_item_from_row(row))


def ignore_knowledge_gap(
    db: Session,
    req: IgnoreKnowledgeGapRequest,
    analyst,
) -> IgnoreKnowledgeGapResponse:
    assert_process_owned(db, req.process_id, analyst)
    row = (
        db.query(InterviewKnowledgeGap)
        .filter(
            InterviewKnowledgeGap.process_id == req.process_id,
            InterviewKnowledgeGap.signature == req.gap_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Knowledge gap not found")

    row.status = "ignored"
    row.analyst_id = analyst.id
    db.commit()
    return IgnoreKnowledgeGapResponse(process_id=req.process_id, gap_id=req.gap_id)


def unignore_knowledge_gap(
    db: Session,
    req: UnignoreKnowledgeGapRequest,
    analyst,
) -> UnignoreKnowledgeGapResponse:
    assert_process_owned(db, req.process_id, analyst)
    row = (
        db.query(InterviewKnowledgeGap)
        .filter(
            InterviewKnowledgeGap.process_id == req.process_id,
            InterviewKnowledgeGap.signature == req.gap_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Knowledge gap not found")

    row.status = "unresolved"
    row.analyst_id = analyst.id
    db.commit()
    return UnignoreKnowledgeGapResponse(process_id=req.process_id, gap_id=req.gap_id)
