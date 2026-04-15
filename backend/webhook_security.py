"""Webhook signature verification for Twilio and Retell.

In production these MUST be enforced. In dev (when secrets aren't configured)
we log a warning and allow the request, so local testing with `ngrok` etc. works.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from typing import Mapping

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Twilio — uses the Twilio SDK's RequestValidator (HMAC-SHA1 over URL + params)
# Docs: https://www.twilio.com/docs/usage/webhooks/webhooks-security
# ---------------------------------------------------------------------------

def verify_twilio(
    *,
    signature_header: str,
    url: str,
    params: Mapping[str, str],
) -> bool:
    """Validate a Twilio webhook. Returns True on success or if not configured.

    Set TWILIO_ENFORCE_SIGNATURES=true in production to hard-fail unsigned requests.
    """
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    enforce = os.environ.get("TWILIO_ENFORCE_SIGNATURES", "false").lower() == "true"

    if not auth_token:
        if enforce:
            logger.error("Twilio signature enforcement on but TWILIO_AUTH_TOKEN not set")
            return False
        logger.warning("Twilio signature verification skipped (auth token not set)")
        return True

    try:
        from twilio.request_validator import RequestValidator
    except Exception:  # noqa: BLE001
        logger.error("twilio package missing for signature verification")
        return not enforce

    validator = RequestValidator(auth_token)
    ok = validator.validate(url, dict(params), signature_header or "")
    if not ok:
        logger.warning("Twilio signature verification FAILED for %s", url)
    return ok


# ---------------------------------------------------------------------------
# Retell — HMAC-SHA256 over raw body with RETELL_WEBHOOK_SECRET.
# Retell's exact header shape has varied; this implementation accepts either
# a plain hex digest in X-Retell-Signature, or a `v=1,t=TS,d=HEX` form.
# ---------------------------------------------------------------------------

def verify_retell(
    *,
    signature_header: str,
    raw_body: bytes,
) -> bool:
    """Validate a Retell webhook. Returns True on success or if not configured."""
    secret = os.environ.get("RETELL_WEBHOOK_SECRET", "")
    enforce = os.environ.get("RETELL_ENFORCE_SIGNATURES", "false").lower() == "true"

    if not secret:
        if enforce:
            logger.error("Retell signature enforcement on but RETELL_WEBHOOK_SECRET not set")
            return False
        logger.warning("Retell signature verification skipped (secret not set)")
        return True

    # Parse either plain hex or v=1,t=TS,d=HEX
    parts = {}
    for segment in (signature_header or "").split(","):
        if "=" in segment:
            k, _, v = segment.partition("=")
            parts[k.strip()] = v.strip()

    sig_hex = parts.get("d") or signature_header or ""
    ts = parts.get("t") or ""

    signed_body = (f"{ts}.".encode() + raw_body) if ts else raw_body
    expected = hmac.new(
        secret.encode("utf-8"),
        signed_body,
        hashlib.sha256,
    ).hexdigest()

    ok = hmac.compare_digest(expected, sig_hex)
    if not ok:
        logger.warning("Retell signature verification FAILED")
    return ok
