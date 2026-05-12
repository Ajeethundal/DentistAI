"""Paddle Billing routes: pricing, checkout prep, webhook, subscription status."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.paddle_client import (
    PaddleClient,
    client_side_environment,
    paddle_environment,
    plan_for_price_id,
    price_id_for,
    verify_webhook_signature,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/paddle", tags=["paddle"])


# ---------------------------------------------------------------------------
# Plan catalog — prices shown in the UI. Source of truth for displayed pricing.
# The actual amount charged comes from Paddle based on price_id.
# ---------------------------------------------------------------------------
PLAN_CATALOG: Dict[str, Dict[str, Any]] = {
    "starter": {
        "slug": "starter",
        "name": "Starter",
        "price_display": "$99",
        "interval": "month",
        "description": "For solo practitioners getting started with AI.",
        "features": [
            "WhatsApp patient messaging",
            "Smart appointment scheduling",
            "Patient management (up to 200)",
            "Email reminders",
            "ARIA chat assistant",
        ],
        "cta": "Start Free Trial",
        "popular": False,
    },
    "growth": {
        "slug": "growth",
        "name": "Growth",
        "price_display": "$249",
        "interval": "month",
        "description": "For growing practices ready to automate the phones.",
        "features": [
            "Everything in Starter",
            "AI voice calling (100 min/mo)",
            "Unlimited WhatsApp messaging",
            "Google Calendar sync",
            "No-show auto-recall",
            "Unlimited patients",
        ],
        "cta": "Start Free Trial",
        "popular": True,
    },
    "pro": {
        "slug": "pro",
        "name": "Pro",
        "price_display": "$499",
        "interval": "month",
        "description": "For busy practices that need a full AI front desk.",
        "features": [
            "Everything in Growth",
            "Unlimited AI voice minutes",
            "Multi-doctor support",
            "Priority support + SLA",
            "Dedicated WhatsApp number",
            "Custom integrations",
        ],
        "cta": "Talk to sales",
        "popular": False,
    },
}


def _get_user_sync(request: Request):
    """Auth helper used inside routes."""
    # Import lazily to avoid circular dep at module load.
    from backend.server import get_current_user
    return get_current_user(request)


# ---------------------------------------------------------------------------
# Public: plan catalog (no auth needed — used by landing/pricing page)
# ---------------------------------------------------------------------------
@router.get("/plans")
async def list_plans():
    """Return the public plan catalog + whether each plan is configured."""
    out = []
    for slug, plan in PLAN_CATALOG.items():
        configured = bool(price_id_for(slug))
        out.append({**plan, "configured": configured, "price_id": price_id_for(slug)})
    return {
        "plans": out,
        "environment": client_side_environment(),
    }


# ---------------------------------------------------------------------------
# Client config for Paddle.js initialization (public by design)
# ---------------------------------------------------------------------------
@router.get("/config")
async def paddle_config():
    """Return the Paddle.js client-side token + environment so the frontend
    can initialize the SDK. The client-side token is SAFE to expose."""
    demo = os.environ.get("DEMO_MODE", "false").lower() == "true"
    return {
        "environment": client_side_environment(),
        "client_token": os.environ.get("PADDLE_CLIENT_TOKEN", ""),
        "demo_mode": demo,
    }


# ---------------------------------------------------------------------------
# Get current user's subscription (authed)
# ---------------------------------------------------------------------------
@router.get("/subscription")
async def my_subscription(request: Request):
    from backend.server import get_current_user
    user = await get_current_user(request)
    db = request.app.state.db
    practice = await db.practices.find_one(
        {"practice_id": user.get("practice_id", "")}, {"_id": 0}
    ) or {}
    return {
        "plan": practice.get("subscription_plan", "free"),
        "status": practice.get("subscription_status", "inactive"),
        "current_period_end": practice.get("subscription_current_period_end"),
        "paddle_subscription_id": practice.get("paddle_subscription_id"),
        "paddle_customer_id": practice.get("paddle_customer_id"),
    }


# ---------------------------------------------------------------------------
# Cancel subscription (end of period)
# ---------------------------------------------------------------------------
@router.post("/subscription/cancel")
async def cancel_subscription(request: Request):
    from backend.server import get_current_user
    user = await get_current_user(request)
    db = request.app.state.db
    practice = await db.practices.find_one(
        {"practice_id": user.get("practice_id", "")}
    )
    if not practice:
        raise HTTPException(404, "Practice not found")
    sub_id = practice.get("paddle_subscription_id")
    if not sub_id:
        raise HTTPException(400, "No active subscription to cancel")

    client = PaddleClient()
    try:
        data = await client.cancel_subscription(sub_id)
    except Exception as e:  # noqa: BLE001
        logger.exception("Paddle cancel failed")
        raise HTTPException(502, f"Paddle error: {e}") from e

    await db.practices.update_one(
        {"practice_id": user.get("practice_id", "")},
        {"$set": {
            "subscription_status": "cancelled",
            "subscription_updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True, "effective_at": data.get("scheduled_change", {}).get("effective_at")}


# ---------------------------------------------------------------------------
# Demo activation — lets a demo user "subscribe" to a plan instantly without
# going through real Paddle checkout. Only available when DEMO_MODE=true.
# ---------------------------------------------------------------------------
@router.post("/demo-activate")
async def demo_activate(request: Request):
    if os.environ.get("DEMO_MODE", "false").lower() != "true":
        raise HTTPException(403, "Demo activation disabled — set DEMO_MODE=true")
    from backend.server import get_current_user
    from backend.demo_mode import demo_subscription_payload
    user = await get_current_user(request)
    body = await request.json()
    plan = (body.get("plan") or "starter").lower()
    if plan not in ("starter", "growth", "pro"):
        raise HTTPException(400, "plan must be starter, growth, or pro")
    update = demo_subscription_payload(plan)
    db = request.app.state.db
    await db.practices.update_one(
        {"practice_id": user.get("practice_id", "")},
        {"$set": update}, upsert=True,
    )
    return {"ok": True, "plan": plan, "status": "active", "demo": True}


# ---------------------------------------------------------------------------
# Webhook (public, signature-verified)
# ---------------------------------------------------------------------------
@router.post("/webhook")
async def paddle_webhook(request: Request):
    db = request.app.state.db
    raw = await request.body()
    signature = request.headers.get("Paddle-Signature", "")
    secret = os.environ.get("PADDLE_WEBHOOK_SECRET", "")

    if not secret:
        # In dev we accept unverified webhooks to aid testing. In prod
        # we reject hard.
        if paddle_environment() == "sandbox":
            logger.warning("PADDLE_WEBHOOK_SECRET not set — accepting unverified webhook in sandbox")
        else:
            raise HTTPException(500, "Webhook secret not configured")
    elif not verify_webhook_signature(
        raw_body=raw, signature_header=signature, secret=secret
    ):
        logger.warning("Paddle webhook signature verification failed")
        raise HTTPException(401, "Invalid signature")

    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Invalid JSON")

    event_type = payload.get("event_type") or ""
    data = payload.get("data") or {}
    logger.info("Paddle webhook: %s id=%s", event_type, data.get("id"))

    # Log every webhook for audit
    await db.paddle_events.insert_one({
        "event_type": event_type,
        "event_id": payload.get("event_id"),
        "occurred_at": payload.get("occurred_at"),
        "data": data,
        "received_at": datetime.now(timezone.utc).isoformat(),
    })

    # Dispatch by event type
    if event_type.startswith("subscription."):
        await _handle_subscription_event(db, event_type, data)
    elif event_type == "transaction.completed":
        await _handle_transaction_completed(db, data)

    return {"ok": True}


async def _handle_subscription_event(db, event_type: str, data: Dict[str, Any]):
    sub_id = data.get("id")
    customer_id = data.get("customer_id")
    status = data.get("status", "").lower()  # active, paused, cancelled, etc.

    # Extract practice_id from custom_data (set at checkout)
    custom = data.get("custom_data") or {}
    practice_id = custom.get("practice_id")
    if not practice_id:
        logger.warning("Subscription %s has no practice_id in custom_data", sub_id)
        return

    # Plan slug from the subscribed price_id
    items = data.get("items") or []
    plan = "free"
    for item in items:
        price = item.get("price") or {}
        price_id = price.get("id")
        if price_id:
            mapped = plan_for_price_id(price_id)
            if mapped:
                plan = mapped
                break

    period_end = data.get("current_billing_period", {}).get("ends_at")

    update = {
        "paddle_subscription_id": sub_id,
        "paddle_customer_id": customer_id,
        "subscription_plan": plan if status in ("active", "trialing") else "free",
        "subscription_status": status or "inactive",
        "subscription_current_period_end": period_end,
        "subscription_updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.practices.update_one(
        {"practice_id": practice_id}, {"$set": update}, upsert=True
    )
    logger.info(
        "Practice %s subscription updated: plan=%s status=%s", practice_id, plan, status
    )


async def _handle_transaction_completed(db, data: Dict[str, Any]):
    """A one-off transaction or initial subscription payment completed.
    Record it for audit / invoice history."""
    custom = data.get("custom_data") or {}
    practice_id = custom.get("practice_id")
    if not practice_id:
        return
    await db.paddle_transactions.insert_one({
        "transaction_id": data.get("id"),
        "practice_id": practice_id,
        "status": data.get("status"),
        "invoice_id": data.get("invoice_id"),
        "invoice_number": data.get("invoice_number"),
        "total": (data.get("details") or {}).get("totals", {}).get("total"),
        "currency": (data.get("details") or {}).get("totals", {}).get("currency_code"),
        "created_at": data.get("created_at"),
        "received_at": datetime.now(timezone.utc).isoformat(),
    })
