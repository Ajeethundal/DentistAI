"""Unit tests for Paddle webhook signature verification. No server required."""
import hmac
import hashlib
import time

import pytest

from backend.paddle_client import verify_webhook_signature


SECRET = "pdl_ntfset_01test_SUPERSECRETPHRASE"


def _sign(body: bytes, ts: int, secret: str = SECRET) -> str:
    signed = f"{ts}:".encode() + body
    digest = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"ts={ts};h1={digest}"


def test_valid_signature_accepted():
    body = b'{"event_type":"subscription.created","data":{}}'
    ts = int(time.time())
    header = _sign(body, ts)
    assert verify_webhook_signature(raw_body=body, signature_header=header, secret=SECRET) is True


def test_tampered_body_rejected():
    body = b'{"event_type":"subscription.created","data":{}}'
    ts = int(time.time())
    header = _sign(body, ts)
    # Tamper the body AFTER signing
    tampered = body + b'tampered'
    assert verify_webhook_signature(raw_body=tampered, signature_header=header, secret=SECRET) is False


def test_wrong_secret_rejected():
    body = b'{"x":1}'
    ts = int(time.time())
    header = _sign(body, ts, secret="wrong-secret")
    assert verify_webhook_signature(raw_body=body, signature_header=header, secret=SECRET) is False


def test_old_timestamp_rejected():
    body = b'{"x":1}'
    ts = int(time.time()) - 9999  # way outside default 5min tolerance
    header = _sign(body, ts)
    assert verify_webhook_signature(raw_body=body, signature_header=header, secret=SECRET) is False


def test_missing_parts_rejected():
    body = b'{"x":1}'
    assert verify_webhook_signature(raw_body=body, signature_header="", secret=SECRET) is False
    assert verify_webhook_signature(raw_body=body, signature_header="ts=;h1=", secret=SECRET) is False
    assert verify_webhook_signature(raw_body=body, signature_header="garbage", secret=SECRET) is False


def test_empty_secret_rejected():
    body = b'{"x":1}'
    ts = int(time.time())
    header = _sign(body, ts)
    assert verify_webhook_signature(raw_body=body, signature_header=header, secret="") is False
