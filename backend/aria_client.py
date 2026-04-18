"""ARIA chat client — supports Anthropic Claude, Groq (free), and demo fallback.

Priority order:
  1. Anthropic Claude (if ANTHROPIC_API_KEY set + has credits)
  2. Groq (if GROQ_API_KEY set — free tier, very fast)
  3. Canned demo replies (if DEMO_MODE=true)
  4. Graceful "not configured" message
"""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def _anthropic_key() -> str:
    return os.environ.get("ANTHROPIC_API_KEY", "").strip()


def _groq_key() -> str:
    return os.environ.get("GROQ_API_KEY", "").strip()


def is_configured() -> bool:
    return bool(_anthropic_key()) or bool(_groq_key())


async def _call_anthropic(system_prompt: str, user_message: str, max_tokens: int) -> Optional[str]:
    """Try Anthropic Claude. Returns None on failure so we can fall through."""
    key = _anthropic_key()
    if not key:
        return None
    try:
        from anthropic import AsyncAnthropic
        resolved_model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
        client = AsyncAnthropic(api_key=key)
        resp = await client.messages.create(
            model=resolved_model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        parts = [block.text for block in resp.content if getattr(block, "type", None) == "text"]
        reply = "".join(parts).strip()
        if reply:
            return reply
    except Exception as e:
        logger.warning("Anthropic call failed (falling through to Groq): %s: %s", type(e).__name__, e)
    return None


async def _call_groq(system_prompt: str, user_message: str, max_tokens: int) -> Optional[str]:
    """Try Groq (free tier). Uses httpx directly — no extra dependencies."""
    key = _groq_key()
    if not key:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            reply = data["choices"][0]["message"]["content"].strip()
            if reply:
                return reply
    except Exception as e:
        logger.warning("Groq call failed: %s: %s", type(e).__name__, e)
    return None


async def chat(
    *,
    system_prompt: str,
    user_message: str,
    model: str = "",
    max_tokens: int = 1024,
) -> str:
    """Return ARIA's reply. Tries Anthropic → Groq → demo → fallback."""

    # 1. Try Anthropic Claude (paid, best quality)
    reply = await _call_anthropic(system_prompt, user_message, max_tokens)
    if reply:
        return reply

    # 2. Try Groq (free tier, fast, good quality)
    reply = await _call_groq(system_prompt, user_message, max_tokens)
    if reply:
        return reply

    # 3. Demo mode canned replies
    if os.environ.get("DEMO_MODE", "false").lower() == "true":
        from backend.demo_mode import canned_aria_reply
        return canned_aria_reply(user_message)

    # 4. Nothing configured
    if not _anthropic_key() and not _groq_key():
        return (
            "ARIA is not fully configured yet. Add ANTHROPIC_API_KEY or "
            "GROQ_API_KEY to enable AI-powered responses."
        )

    return "I'm having a brief connection issue. Please try again in a moment."
