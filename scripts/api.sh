#!/usr/bin/env bash
# Start the FastAPI service.
# Automatically creates a venv and installs deps on first run.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
API_DIR="$ROOT_DIR/services/api"
VENV_DIR="$API_DIR/.venv"

# Load .env from project root so Modal tokens and DATABASE_URL are available
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

# Kill any existing process on port 4000 to avoid EADDRINUSE
existing_pid=$(lsof -ti:4000 2>/dev/null || true)
if [ -n "$existing_pid" ]; then
  echo "[api] Killing existing process on port 4000 (PID $existing_pid)..."
  kill $existing_pid 2>/dev/null || true
  sleep 1
fi

# Resolve Python 3.12 (required — 3.14 lacks pre-built wheels for pydantic-core etc.)
PYTHON=""
for candidate in python3.12 python3.13 python3.11 python3; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "[api] Error: no suitable Python found. Install Python 3.12: brew install python@3.12"
  exit 1
fi

# Create venv + install deps if missing
if [ ! -d "$VENV_DIR" ]; then
  echo "[api] Creating Python venv with $PYTHON..."
  "$PYTHON" -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --quiet -r "$API_DIR/requirements.txt"
  echo "[api] Dependencies installed."
fi

echo "[api] Starting FastAPI on port 4000..."
exec "$VENV_DIR/bin/uvicorn" main:socket_app --host 0.0.0.0 --port 4000 --app-dir "$API_DIR" --reload --reload-dir "$API_DIR"
