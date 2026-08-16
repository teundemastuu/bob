"""File-based storage for BPMN chatbot outputs.
Initial code drafted in discussion with GitHub Copilot (April 2026) 
Modified and validated by Teun de Mast."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
from datetime import datetime


@dataclass
class StoragePaths:
    base_dir: Path
    json_dir: Path
    xml_dir: Path
    description_dir: Path
    database_path: Path
    process_latest_path: Path
    process_history_path: Path
    thread_metadata_path: Path


def _default_base_dir() -> Path:
    return Path(__file__).resolve().parent / "data"


def get_storage_paths(base_dir: Path | None = None) -> StoragePaths:
    root = base_dir or _default_base_dir()
    return StoragePaths(
        base_dir=root,
        json_dir=root / "json",
        xml_dir=root / "xml",
        description_dir=root / "descriptions",
        database_path=root / "database.json",
        process_latest_path=root / "process_latest.json",
        process_history_path=root / "process_history.json",
        thread_metadata_path=root / "thread_metadata.json",
    )


def ensure_storage(base_dir: Path | None = None) -> StoragePaths:
    paths = get_storage_paths(base_dir)
    paths.json_dir.mkdir(parents=True, exist_ok=True)
    paths.xml_dir.mkdir(parents=True, exist_ok=True)
    paths.description_dir.mkdir(parents=True, exist_ok=True)
    if not paths.database_path.exists():
        paths.database_path.write_text("[]", encoding="utf-8")
    if not paths.process_latest_path.exists():
        paths.process_latest_path.write_text("{}", encoding="utf-8")
    if not paths.process_history_path.exists():
        paths.process_history_path.write_text("{}", encoding="utf-8")
    if not paths.thread_metadata_path.exists():
        paths.thread_metadata_path.write_text("{}", encoding="utf-8")
    return paths


def _read_thread_metadata(paths: StoragePaths) -> dict[str, dict]:
    try:
        raw = paths.thread_metadata_path.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_thread_metadata(paths: StoragePaths, data: dict[str, dict]) -> None:
    paths.thread_metadata_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def set_thread_used_sessions(
    thread_id: str,
    process_id: str,
    used_session_ids: list[str],
    base_dir: Path | None = None,
) -> None:
    paths = ensure_storage(base_dir)
    data = _read_thread_metadata(paths)
    data[str(thread_id)] = {
        "processId": str(process_id),
        "usedSessionIds": [str(item) for item in used_session_ids],
        "usedSessionSnapshots": {str(item): "" for item in used_session_ids},
    }
    _write_thread_metadata(paths, data)


def set_thread_used_session_snapshots(
    thread_id: str,
    process_id: str,
    session_snapshots: dict[str, str],
    base_dir: Path | None = None,
) -> None:
    paths = ensure_storage(base_dir)
    data = _read_thread_metadata(paths)
    normalized = {str(k): str(v) for k, v in session_snapshots.items()}
    data[str(thread_id)] = {
        "processId": str(process_id),
        "usedSessionIds": list(normalized.keys()),
        "usedSessionSnapshots": normalized,
    }
    _write_thread_metadata(paths, data)


def get_thread_used_session_snapshots(thread_id: str, base_dir: Path | None = None) -> dict[str, str]:
    paths = ensure_storage(base_dir)
    data = _read_thread_metadata(paths)
    item = data.get(str(thread_id)) if isinstance(data, dict) else None
    if not isinstance(item, dict):
        return {}

    snapshots = item.get("usedSessionSnapshots")
    if isinstance(snapshots, dict):
        return {str(k): str(v) for k, v in snapshots.items()}

    used = item.get("usedSessionIds")
    if isinstance(used, list):
        return {str(entry): "" for entry in used}
    return {}


def get_thread_used_sessions(thread_id: str, base_dir: Path | None = None) -> list[str]:
    snapshots = get_thread_used_session_snapshots(thread_id, base_dir)
    return list(snapshots.keys())


def _read_process_history(paths: StoragePaths) -> dict[str, list[str]]:
    try:
        raw = paths.process_history_path.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        data = json.loads(raw)
        if not isinstance(data, dict):
            return {}

        normalized: dict[str, list[str]] = {}
        for key, value in data.items():
            if isinstance(value, list):
                normalized[str(key)] = [str(item) for item in value]
        return normalized
    except (OSError, json.JSONDecodeError):
        return {}


def _write_process_history(paths: StoragePaths, mapping: dict[str, list[str]]) -> None:
    paths.process_history_path.write_text(json.dumps(mapping, indent=2), encoding="utf-8")


def append_thread_for_process(process_id: str, thread_id: str, base_dir: Path | None = None) -> None:
    paths = ensure_storage(base_dir)
    history = _read_process_history(paths)
    pid = str(process_id)
    tid = str(thread_id)
    history.setdefault(pid, [])
    if not history[pid] or history[pid][-1] != tid:
        history[pid].append(tid)
    _write_process_history(paths, history)


def get_thread_history_for_process(process_id: str, base_dir: Path | None = None) -> list[str]:
    paths = ensure_storage(base_dir)
    history = _read_process_history(paths)
    return history.get(str(process_id), [])


def branch_history_for_process(
    process_id: str,
    base_thread_id: str,
    new_thread_id: str,
    base_dir: Path | None = None,
) -> None:
    paths = ensure_storage(base_dir)
    pid = str(process_id)
    base_id = str(base_thread_id)
    new_id = str(new_thread_id)

    history = _read_process_history(paths)
    existing = history.get(pid, [])

    if base_id not in existing:
        append_thread_for_process(pid, new_id, base_dir)
        set_latest_thread_for_process(pid, new_id, base_dir)
        return

    base_index = existing.index(base_id)
    future_threads = existing[base_index + 1 :]

    for thread_id in future_threads:
        delete_entry_by_thread(thread_id, base_dir)

    refreshed = _read_process_history(paths).get(pid, [])
    if base_id in refreshed:
        truncated = refreshed[: refreshed.index(base_id) + 1]
    else:
        truncated = []

    truncated.append(new_id)
    history = _read_process_history(paths)
    history[pid] = truncated
    _write_process_history(paths, history)

    latest = _read_process_latest(paths)
    latest[pid] = new_id
    _write_process_latest(paths, latest)


def _read_process_latest(paths: StoragePaths) -> dict[str, str]:
    try:
        raw = paths.process_latest_path.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        data = json.loads(raw)
        if isinstance(data, dict):
            return {str(key): str(value) for key, value in data.items()}
        return {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_process_latest(paths: StoragePaths, mapping: dict[str, str]) -> None:
    paths.process_latest_path.write_text(json.dumps(mapping, indent=2), encoding="utf-8")


def set_latest_thread_for_process(process_id: str, thread_id: str, base_dir: Path | None = None) -> None:
    paths = ensure_storage(base_dir)
    mapping = _read_process_latest(paths)
    mapping[str(process_id)] = str(thread_id)
    _write_process_latest(paths, mapping)


def get_latest_thread_for_process(process_id: str, base_dir: Path | None = None) -> str | None:
    paths = ensure_storage(base_dir)
    mapping = _read_process_latest(paths)
    thread_id = mapping.get(str(process_id))
    return str(thread_id) if thread_id else None


def remove_latest_thread_for_process(process_id: str, base_dir: Path | None = None) -> None:
    paths = ensure_storage(base_dir)
    mapping = _read_process_latest(paths)
    if str(process_id) in mapping:
        del mapping[str(process_id)]
        _write_process_latest(paths, mapping)


def remove_process_history(process_id: str, base_dir: Path | None = None) -> None:
    paths = ensure_storage(base_dir)
    history = _read_process_history(paths)
    if str(process_id) in history:
        del history[str(process_id)]
        _write_process_history(paths, history)


def clear_history_for_process(process_id: str, base_dir: Path | None = None) -> int:
    paths = ensure_storage(base_dir)
    history = _read_process_history(paths)
    thread_ids = list(history.get(str(process_id), []))

    for thread_id in thread_ids:
        delete_entry_by_thread(thread_id, base_dir)

    remove_process_history(process_id, base_dir)
    remove_latest_thread_for_process(process_id, base_dir)
    return len(thread_ids)


def _read_database(paths: StoragePaths) -> list[dict]:
    try:
        raw = paths.database_path.read_text(encoding="utf-8")
        if not raw.strip():
            return []
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def _write_database(paths: StoragePaths, data: list[dict]) -> None:
    paths.database_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def add_entry_to_database(title: str, scenario: str, thread_id: str, base_dir: Path | None = None) -> None:
    paths = ensure_storage(base_dir)
    data = _read_database(paths)
    data.append(
        {
            "thread": thread_id,
            "title": title,
            "scenario": scenario,
            "time": datetime.utcnow().isoformat(),
            "path": f"data/xml/{thread_id}.xml",
            "xmlPath": f"data/xml/{thread_id}.xml",
            "jsonPath": f"data/json/{thread_id}.json",
            "descriptionPath": f"data/descriptions/{thread_id}.json",
        }
    )
    _write_database(paths, data)


def update_entry_timestamp(thread_id: str, scenario_append: str, base_dir: Path | None = None) -> None:
    paths = ensure_storage(base_dir)
    data = _read_database(paths)
    for item in data:
        if item.get("thread") == thread_id:
            item["time"] = datetime.utcnow().isoformat()
            if scenario_append:
                item["scenario"] = (item.get("scenario") or "") + "\n(NEXT)" + scenario_append
    _write_database(paths, data)


def get_database_entries(base_dir: Path | None = None) -> list[dict]:
    paths = ensure_storage(base_dir)
    return _read_database(paths)


def get_xml_content(filename: str, base_dir: Path | None = None) -> str | None:
    paths = ensure_storage(base_dir)
    file_path = (paths.xml_dir / filename).resolve()
    if not str(file_path).startswith(str(paths.xml_dir.resolve())):
        return None
    if not file_path.exists():
        return None
    return file_path.read_text(encoding="utf-8")


def get_description_content(thread_id: str, base_dir: Path | None = None) -> dict | None:
    paths = ensure_storage(base_dir)
    file_path = (paths.description_dir / f"{thread_id}.json").resolve()
    if not str(file_path).startswith(str(paths.description_dir.resolve())):
        return None
    if not file_path.exists():
        return None
    try:
        content = json.loads(file_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return content if isinstance(content, dict) else None


def save_description_content(thread_id: str, description: dict, base_dir: Path | None = None) -> None:
    paths = ensure_storage(base_dir)
    description_path = paths.description_dir / f"{thread_id}.json"
    description_path.write_text(json.dumps(description, indent=2), encoding="utf-8")


def save_xml_content(thread_id: str, xml: str, base_dir: Path | None = None) -> None:
    paths = ensure_storage(base_dir)
    update_entry_timestamp(thread_id, "", base_dir)
    xml_path = paths.xml_dir / f"{thread_id}.xml"
    xml_path.write_text(xml, encoding="utf-8")


def delete_entry_by_thread(thread_id: str, base_dir: Path | None = None) -> None:
    paths = ensure_storage(base_dir)
    xml_path = paths.xml_dir / f"{thread_id}.xml"
    json_path = paths.json_dir / f"{thread_id}.json"
    description_path = paths.description_dir / f"{thread_id}.json"

    if xml_path.exists():
        xml_path.unlink()
    if json_path.exists():
        json_path.unlink()
    if description_path.exists():
        description_path.unlink()

    data = _read_database(paths)
    data = [entry for entry in data if entry.get("thread") != thread_id]
    _write_database(paths, data)

    mapping = _read_process_latest(paths)
    filtered = {pid: tid for pid, tid in mapping.items() if tid != thread_id}
    _write_process_latest(paths, filtered)

    history = _read_process_history(paths)
    latest = _read_process_latest(paths)
    for pid, thread_ids in history.items():
        cleaned = [tid for tid in thread_ids if tid != thread_id]
        history[pid] = cleaned
        if cleaned:
            latest[pid] = cleaned[-1]
        elif pid in latest:
            del latest[pid]
    _write_process_history(paths, history)
    _write_process_latest(paths, latest)

    metadata = _read_thread_metadata(paths)
    if str(thread_id) in metadata:
        del metadata[str(thread_id)]
        _write_thread_metadata(paths, metadata)


def delete_database(base_dir: Path | None = None) -> None:
    paths = ensure_storage(base_dir)
    for item in paths.xml_dir.glob("*.xml"):
        item.unlink(missing_ok=True)
    for item in paths.json_dir.glob("*.json"):
        item.unlink(missing_ok=True)
    for item in paths.description_dir.glob("*.json"):
        item.unlink(missing_ok=True)
    paths.database_path.write_text("", encoding="utf-8")
