# syntax=docker/dockerfile:1.6
# --- Base image ---
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps (build-essential needed for some python packages that compile)
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# --- Install Python deps (cached layer) ---
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --upgrade pip \
 && pip install -r /app/backend/requirements.txt

# --- Copy source ---
COPY backend /app/backend

# Non-root user
RUN useradd --create-home --shell /bin/bash appuser \
 && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Healthcheck hits /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-8000}/api/health || exit 1

# AWS EB, App Runner, Fargate, Lightsail, Railway, Fly all set $PORT.
CMD ["sh", "-c", "uvicorn backend.server:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2 --proxy-headers --forwarded-allow-ips='*'"]
