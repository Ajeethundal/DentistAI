"""ARIA chat client — wraps Anthropic directly (no emergentintegrations).

If ANTHROPIC_API_KEY is unset, `chat()` returns a friendly degraded message
instead of raising. This lets the backend boot cleanly even before the key
is configured in production.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def _key() -> str:
    return os.environ.get("ANTHROPIC_API_KEY", "").strip()


def is_configured() -> bool:
    return bool(_key())


async def chat(
    *,
    system_prompt: str,
    user_message: str,
    model: str = "",
    max_tokens: int = 1024,
) -> str:
    """Return ARIA's reply, or a canned demo reply, or a graceful fallback."""
    key = _key()
    if not key:
        # In demo mode, produce a convincing canned reply so the demo account
        # still showcases ARIA. In real environments without a key, nudge
        # the admin to configure Anthropic.
        if os.environ.get("DEMO_MODE", "false").lower() == "true":
            from backend.demo_mode import canned_aria_reply
            return canned_aria_reply(user_message)
        return (
            "ARIA is not fully configured yet. Ask the administrator to add "
            "ANTHROPIC_API_KEY to the backend environment to enable me."
        )
    try:
        # Local import so missing dep doesn't break module load
        from anthropic import AsyncAnthropic
    except Exception:  # noqa: BLE001
        logger.error("anthropic package not installed")
        return "ARIA is temporarily unavailable. Please try again shortly."

    try:
        resolved_model = model or os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
        client = AsyncAnthropic(api_key=key)
        resp = await client.messages.create(
            model=resolved_model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        # Collect text blocks
        parts = []
        for block in resp.content:
            if getattr(block, "type", None) == "text":
                parts.append(block.text)
        reply = "".join(parts).strip()
        return reply or "I didn't catch that — could you rephrase?"
    except Exception as e:  # noqa: BLE001
        logger.error("ARIA Anthropic call failed: %s: %s", type(e).__name__, e)
        return "I'm having a brief connection issue. Please try again in a moment."
