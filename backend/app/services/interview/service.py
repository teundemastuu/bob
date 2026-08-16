"""
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.interview import InterviewSession, QAItem
from app.models.user import User as UserModel
from app.models.process import process_experts
from app.services.interview import engine as interview_engine
from app.services.interview import summary as interview_summary
from app.models.process import Process
from app.core.security import decrypt_openai_key

def _session_to_dict(session: InterviewSession, expert_email: str | None = None) -> dict:
    session_dict = session.__dict__.copy()
    session_dict = {k: v for k, v in session_dict.items() if not k.startswith('_')}
    session_dict['qa_items'] = [
        {
            'id': item.id,
            'step_id': item.step_id,
            'question': item.question,
            'answer': item.answer,
            'created_at': item.created_at,
        }
        for item in session.qa_items
    ]
    if expert_email is not None:
        session_dict['expert_email'] = expert_email
    return session_dict


def summarize_completed_session_background(session_id: str) -> None:
    db = SessionLocal()
    try:
        s = db.get(InterviewSession, session_id)
        if not s or s.status != "completed" or s.session_summary is not None:
            return

        analyst = db.get(UserModel, s.protocol_version.created_by_id) if s.protocol_version else None
        api_key = None
        if analyst and analyst.openai_api_key:
            api_key = decrypt_openai_key(analyst.openai_api_key)
        if not api_key:
            return

        qa_dicts = [{"question": q.question, "answer": q.answer} for q in s.qa_items]
        if not qa_dicts:
            return

        process_name = s.process.name if s.process else None
        role_row = db.execute(
            select(process_experts.c.role).where(
                process_experts.c.process_id == s.process_id,
                process_experts.c.expert_id == s.expert_id,
            )
        ).first()
        expert_role = role_row[0] if role_row else None

        summary = interview_summary.summarize_session(
            qa_items=qa_dicts,
            process_name=process_name,
            expert_role=expert_role,
            api_key=api_key,
        )
        if summary:
            s.session_summary = summary
            db.commit()
    except Exception:
        pass
    finally:
        db.close()


def activate_session(db: Session, session_id: str, expert: UserModel):
    s = db.get(InterviewSession, session_id)
    if not s:
        return None

    if str(s.expert_id) != str(expert.id):
        raise PermissionError("Not your session")

    if s.status == "active":
        return s

    if s.status not in ("protocol_created", "paused"):
        raise ValueError(f"Cannot activate a {s.status} session")

    s.status = "active"
    db.commit()
    db.refresh(s)
    return s


def get_my_sessions(db: Session, expert: UserModel):
    sessions = db.query(InterviewSession).filter(
        InterviewSession.expert_id == expert.id
    ).order_by(InterviewSession.created_at.desc()).all()

    result = []
    for session in sessions:
        db.refresh(session)
        session_dict = _session_to_dict(session, expert.email)
        if session.process:
            session_dict['process_name'] = session.process.name
        protocol_content = session.protocol_version.content if session.protocol_version else None
        if isinstance(protocol_content, dict):
            intro = str(protocol_content.get('expert_intro') or '').strip()
            session_dict['interview_intro'] = intro or None
        result.append(session_dict)

    return result


def next_question(db: Session, session_id: str, expert: UserModel):
    s = db.get(InterviewSession, session_id)
    if not s:
        return None, None

    if str(s.expert_id) != str(expert.id):
        raise PermissionError("Not your session")

    if s.status != "active":
        return {"done": False, "message": f"Session is {s.status}.", "session_id": s.id}, False

    if s.pending_question and s.pending_step_id:
        return (
            {
                "done": False,
                "step_id": s.pending_step_id,
                "question": s.pending_question,
                "session_id": s.id,
                "process_id": s.process_id,
                "current_step_index": s.current_step_index,
            },
            False,
        )

    analyst = db.get(UserModel, s.protocol_version.created_by_id) if s.protocol_version else None
    api_key = None
    if analyst and analyst.openai_api_key:
        api_key = decrypt_openai_key(analyst.openai_api_key)

    step = interview_engine.get_next_question(s.protocol_version.content, s.qa_items, s.current_step_index, api_key)
    if step is None:
        s.status = "completed"
        db.commit()
        needs_summary = s.session_summary is None
        return (
            {
                "done": True,
                "message": "Thanks for completing the interview",
                "session_id": s.id,
                "process_id": s.process_id,
                "current_step_index": s.current_step_index,
            },
            needs_summary, # if true, background job for summarization will be triggered
        )

    s.pending_step_id = step.get("id")
    s.pending_question = step.get("question")
    s.pending_step_index = s.current_step_index
    db.commit()
    return (
        {
            "done": False,
            "step_id": step["id"],
            "question": step["question"],
            "message": step.get("warning"),
            "session_id": s.id,
            "process_id": s.process_id,
            "current_step_index": s.current_step_index,
        },
        False, 
    )


def answer(db: Session, session_id: str, req, expert: UserModel):
    s = db.get(InterviewSession, session_id)
    if not s:
        return None

    if str(s.expert_id) != str(expert.id):
        raise PermissionError("Not your session")
    if s.status != "active":
        raise ValueError(f"Session is {s.status}")

    item = QAItem(
        session_id=s.id,
        step_id=req.step_id,
        question=req.question,
        answer=req.text,
    )
    db.add(item)

    s.current_step_index += 1
    s.pending_step_id = None
    s.pending_question = None
    s.pending_step_index = None
    db.commit()

    return {"success": True, "current_step_index": s.current_step_index}


def get_process_sessions(db: Session, process_id: str, analyst: UserModel):
    # This is used for the knowledge tab to show all the sessions
    process = db.get(Process, process_id)
    if not process:
        return None
    if process.created_by_id != analyst.id:
        raise PermissionError("Not your process")

    sessions = db.query(InterviewSession).filter(InterviewSession.process_id == process_id).order_by(InterviewSession.created_at.desc()).all()

    result = []
    for session in sessions:
        db.refresh(session)
        session_dict = _session_to_dict(session)
        expert = db.get(UserModel, session.expert_id)
        if expert:
            session_dict['expert_email'] = expert.email
        result.append(session_dict)

    return result


def pause_session(db: Session, session_id: str, expert: UserModel):
    s = db.get(InterviewSession, session_id)
    if not s:
        return None

    if str(s.expert_id) != str(expert.id):
        raise PermissionError("Not your session")

    if s.status != "active":
        raise ValueError(f"Cannot pause a {s.status} session")

    s.status = "paused"
    db.commit()
    return {"status": "paused", "message": "Session paused successfully"}


