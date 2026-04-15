"""Paddle Billing client + webhook verification.

Paddle does not publish an official Python SDK. We hit the REST API directly
and verify webhook signatures using the documented HMAC-SHA256 scheme.

Docs:
- API: https://developer.paddle.com/api-reference/overview
- Webhooks: https://developer.paddle.com/webhooks/signature-verification
"""
from __future__ import annotations

import hmac
import hashlib
import logging
import os
import time
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# Plan hierarchy. Higher = more access. "free" is the default for unpaid users.
PLAN_LEVELS: Dict[str, int] = {
    "free": 0,
    "starter": 1,
    "growth": 2,
    "pro": 3,
}


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default) or default


def paddle_environment() -> str:
    return _env("PADDLE_ENVIRONMENT", "sandbox").lower()


def paddle_base_url() -> str:
    return (
        "https://sandbox-api.paddle.com"
        if paddle_environment() == "sandbox"
        else "https://api.paddle.com"
    )


def client_side_environment() -> str:
    """Returned to frontend so Paddle.js targets the right environment."""
    return paddle_environment()


def price_id_for(plan: str) -> Optional[str]:
    """Map internal plan slug -> Paddle price id."""
    mapping = {
        "starter": _env("PADDLE_PRICE_STARTER"),
        "growth": _env("PADDLE_PRICE_GROWTH"),
        "pro": _env("PADDLE_PRICE_PRO"),
    }
    return mapping.get(plan) or None


def plan_for_price_id(price_id: str) -> Optional[str]:
    """Reverse lookup: given a Paddle price_id, return the internal plan slug."""
    if not price_id:
        return None
    pairs = [
        (_env("PADDLE_PRICE_STARTER"), "starter"),
        (_env("PADDLE_PRICE_GROWTH"), "growth"),
        (_env("PADDLE_PRICE_PRO"), "pro"),
    ]
    for configured_id, plan in pairs:
        if configured_id and configured_id == price_id:
            return plan
    return None


# ---------------------------------------------------------------------------
# Webhook signature verification
# ---------------------------------------------------------------------------

def verify_webhook_signature(
    *, raw_body: bytes, signature_header: str, secret: str, tolerance_seconds: int = 300
) -> bool:
    """Verify Paddle Notifications HMAC signature.

    The `Paddle-Signature` header is of the form:
        ts=1677845800;h1=abcdef123456...
    We recompute HMAC-SHA256 over `ts:body` using the shared secret and
    constant-time compare to `h1`. Also enforce a freshness window to prevent
    replay attacks.
    """
    if not signature_header or not secret:
        return False

    parts: Dict[str, str] = {}
    for segment in signature_header.split(";"):
        if "=" in segment:
            key, _, value = segment.partition("=")
            parts[key.strip()] = value.strip()

    ts = parts.get("ts")
    sig = parts.get("h1")
    if not ts or not sig:
        return False

    # Freshness window
    try:
        ts_int = int(ts)
    except ValueError:
        return False
    if abs(int(time.time()) - ts_int) > tolerance_seconds:
        logger.warning("Paddle webhook rejected: timestamp outside tolerance")
        return False

    signed_payload = f"{ts}:".encode("utf-8") + raw_body
    expected = hmac.new(
        secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, sig)


# ---------------------------------------------------------------------------
# Thin API client (only the endpoints we need)
# ---------------------------------------------------------------------------

class PaddleClient:
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or _env("PADDLE_API_KEY")
        self.base_url = base_url or paddle_base_url()

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Paddle-Version": "1",
        }

    async def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(
                f"{self.base_url}/subscriptions/{subscription_id}",
                headers=self._headers(),
            )
            r.raise_for_status()
            return r.json().get("data", {})

    async def cancel_subscription(
        self, subscription_id: str, effective_from: str = "next_billing_period"
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                f"{self.base_url}/subscriptions/{subscription_id}/cancel",
                headers=self._headers(),
                json={"effective_from": effective_from},
            )
            r.raise_for_status()
            return r.json().get("data", {})

    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(
                f"{self.base_url}/customers/{customer_id}",
                headers=self._headers(),
            )
            r.raise_for_status()
            return r.json().get("data", {})
