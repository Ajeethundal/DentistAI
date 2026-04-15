"""Rate limiting setup (slowapi).

We attach a module-level limiter that server.py imports. Apply to routes via:

    @api_router.post("/auth/login")
    @limiter.limit("5/minute")
    async def login(req, request: Request, ...):

Notes:
- Rate limit keys on client IP by default. Behind an ALB/CloudFront, trust X-Forwarded-For.
- slowapi raises RateLimitExceeded; we let FastAPI translate it to 429.
"""
from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address


def _key_func(request):
    # Prefer the first entry of X-Forwarded-For when behind a proxy
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return get_remote_address(request)


# Disabled automatically in tests if RATE_LIMIT_DISABLED=true.
_disabled = os.environ.get("RATE_LIMIT_DISABLED", "false").lower() == "true"

limiter = Limiter(
    key_func=_key_func,
    enabled=not _disabled,
    default_limits=["200/minute"],  # sane global default
)
