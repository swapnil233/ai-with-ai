#!/usr/bin/env bash
# Start the Python sandbox sidecar service.
# Automatically creates a venv and installs deps on first run.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
SANDBOX_DIR="$ROOT_DIR/services/sandbox"
VENV_DIR="$SANDBOX_DIR/.venv"

# Load .env from project root so Modal tokens are available
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

# Kill any existing process on port 8000 to avoid EADDRINUSE
existing_pid=$(lsof -ti:8000 2>/dev/null || true)
if [ -n "$existing_pid" ]; then
  echo "[sandbox] Killing existing process on port 8000 (PID $existing_pid)..."
  kill $existing_pid 2>/dev/null || true
  sleep 1
fi

# Create venv + install deps if missing
if [ ! -d "$VENV_DIR" ]; then
  echo "[sandbox] Creating Python venv..."
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --quiet -r "$SANDBOX_DIR/requirements.txt"
  echo "[sandbox] Dependencies installed."
fi

echo "[sandbox] Starting sidecar on port 8000..."
exec "$VENV_DIR/bin/uvicorn" main:app --host 0.0.0.0 --port 8000 --app-dir "$SANDBOX_DIR" --reload --reload-dir "$SANDBOX_DIR"
