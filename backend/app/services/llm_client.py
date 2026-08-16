"""Shared LLM client wrapper used by services.

Provides a small wrapper around OpenAI calls and JSON fence stripping so
services don't duplicate that logic.
"""
from openai import OpenAI
import json
import os
import logging


logger = logging.getLogger(__name__)


def _strip_json_fence(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    return cleaned.strip()


def call_openai(
    api_key: str | None = None,
    *,
    system: str | None = None,
    user: str | None = None,
    response_format: str | None = None,
):
    model_name = os.getenv("OPENAI_MODEL", "gpt-5o-mini")
    client = OpenAI(api_key=api_key)

    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    if user:
        msgs.append({"role": "user", "content": user})
    if not msgs:
        raise ValueError("call_openai requires at least one of `system` or `user` message content")

    try:
        kwargs = {"model": model_name, "messages": msgs}
        if response_format == "json_object":
            kwargs["response_format"] = {"type": "json_object"}
        response = client.chat.completions.create(**kwargs)
        text = response.choices[0].message.content or ""

        if response_format == "json_object":
            cleaned = _strip_json_fence(text)
            parsed = json.loads(cleaned)
            return parsed

        return text
    except Exception:
        logger.exception("LLM call failed")
        raise
