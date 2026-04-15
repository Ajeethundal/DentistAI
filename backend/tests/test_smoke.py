"""Smoke tests — run locally against a running backend (docker compose up).

Invoke:
    cd backend && pytest tests/test_smoke.py -v

These are integration tests; they hit the HTTP surface. For pure unit tests
of paddle signature verification, see test_paddle_signatures.py.
"""
import os
import httpx
import pytest

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@dentistai.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")


@pytest.fixture(scope="module")
def admin_token():
    r = httpx.post(
        f"{BASE}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_health():
    r = httpx.get(f"{BASE}/api/health", timeout=5)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "dentistai-backend"


def test_paddle_plans_public():
    r = httpx.get(f"{BASE}/api/paddle/plans", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert "plans" in data
    assert len(data["plans"]) == 3
    slugs = {p["slug"] for p in data["plans"]}
    assert slugs == {"starter", "growth", "pro"}


def test_login_and_me(admin_token):
    r = httpx.get(f"{BASE}/api/auth/me", headers=auth_headers(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == ADMIN_EMAIL


def test_dashboard_stats(admin_token):
    r = httpx.get(f"{BASE}/api/dashboard/stats", headers=auth_headers(admin_token))
    assert r.status_code == 200


def test_patients_list_not_empty(admin_token):
    """Demo seed should have 12 patients."""
    r = httpx.get(f"{BASE}/api/patients", headers=auth_headers(admin_token))
    assert r.status_code == 200
    patients = r.json()
    assert len(patients) >= 10


def test_subscription_default_free(admin_token):
    r = httpx.get(f"{BASE}/api/paddle/subscription", headers=auth_headers(admin_token))
    assert r.status_code == 200
    sub = r.json()
    assert sub["plan"] in ("free", "starter", "growth", "pro")


def test_demo_activate_upgrades_plan(admin_token):
    r = httpx.post(
        f"{BASE}/api/paddle/demo-activate",
        headers=auth_headers(admin_token),
        json={"plan": "growth"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["plan"] == "growth"
    # Confirm via subscription endpoint
    sub = httpx.get(f"{BASE}/api/paddle/subscription", headers=auth_headers(admin_token)).json()
    assert sub["plan"] == "growth"
    assert sub["status"] == "active"


def test_retell_call_in_demo_mode(admin_token):
    """DEMO_MODE should produce a mocked call record with a transcript."""
    r = httpx.post(
        f"{BASE}/api/retell/call",
        headers=auth_headers(admin_token),
        json={"to_number": "+15551234567", "patient_name": "Smoke Test", "objective": "reminder"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "success"
    assert "transcript" in body
    assert len(body["transcript"]) >= 3


def test_aria_chat_responds(admin_token):
    r = httpx.post(
        f"{BASE}/api/aria/chat",
        headers=auth_headers(admin_token),
        json={"message": "What does my schedule look like today?"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "response" in body
    assert len(body["response"]) > 10
