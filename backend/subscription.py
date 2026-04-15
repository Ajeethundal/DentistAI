"""Subscription tier gating helpers.

Usage:
    from backend.subscription import requires_plan
    @api_router.post("/calls/start")
    async def start_call(..., user = Depends(requires_plan("growth"))):
        ...
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Callable

from fastapi import Depends, HTTPException, Request

from backend.paddle_client import PLAN_LEVELS


def _demo_mode() -> bool:
    return os.environ.get("DEMO_MODE", "false").lower() == "true"


async def _get_db(request: Request):
    # server.py attaches `request.app.state.db`
    return request.app.state.db


async def _get_user(request: Request) -> dict:
    # Defer to server.get_current_user
    from backend.server import get_current_user  # local import to avoid cycle
    return await get_current_user(request)


def requires_plan(min_plan: str) -> Callable:
    """Dependency factory that enforces subscription tier.

    Demo mode (DEMO_MODE=true) bypasses checks so the demo account can
    exercise all features.
    """
    if min_plan not in PLAN_LEVELS:
        raise ValueError(f"Unknown plan: {min_plan}")

    async def _guard(request: Request, user: dict = Depends(_get_user)) -> dict:
        if _demo_mode():
            return user

        db = await _get_db(request)
        practice = await db.practices.find_one(
            {"practice_id": user.get("practice_id", "")}
        )
        current_plan = (practice or {}).get("subscription_plan", "free")
        current_status = (practice or {}).get("subscription_status", "inactive")

        # If not active, treat as free
        if current_status not in {"active", "trialing", "past_due"}:
            current_plan = "free"

        # past_due gets one grace period — still allow, but status is flagged
        if PLAN_LEVELS.get(current_plan, 0) < PLAN_LEVELS[min_plan]:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "upgrade_required",
                    "current_plan": current_plan,
                    "min_plan": min_plan,
                    "message": f"This feature requires the {min_plan.title()} plan or higher.",
                },
            )

        return user

    return _guard


def has_plan(practice: dict, min_plan: str) -> bool:
    """Non-raising variant for internal checks."""
    plan = practice.get("subscription_plan", "free")
    status = practice.get("subscription_status", "inactive")
    if status not in {"active", "trialing"}:
        plan = "free"
    return PLAN_LEVELS.get(plan, 0) >= PLAN_LEVELS.get(min_plan, 99)


def is_expired(practice: dict) -> bool:
    """Check if subscription has lapsed past the current period end."""
    end = practice.get("subscription_current_period_end")
    if not end:
        return False
    try:
        dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return False
    return dt < datetime.now(timezone.utc)
