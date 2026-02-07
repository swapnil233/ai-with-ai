#!/usr/bin/env bash
# One-command dev startup: pnpm dev
# Starts PostgreSQL + MinIO (Docker), FastAPI (:4000), Next.js (:3000)

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR/services/api"
VENV_DIR="$API_DIR/.venv"

PIDS=()
cleanup() {
  echo ""
  echo "[dev] Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "[dev] Done."
}
trap cleanup EXIT INT TERM

# ── 1. Load .env ────────────────────────────────────────────────────────────
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "[dev] Creating .env from .env.example..."
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi
set -a; source "$ROOT_DIR/.env"; set +a

# ── 2. Docker: PostgreSQL + MinIO ───────────────────────────────────────────
if ! docker info >/dev/null 2>&1; then
  echo "[dev] Warning: Docker is not running — skipping database startup."
  echo "[dev] Start Docker and run: pnpm db:start"
else
  echo "[dev] Starting PostgreSQL + MinIO..."
  docker compose -f "$ROOT_DIR/docker/docker-compose.yml" up postgres minio minio-init -d --wait 2>/dev/null || \
  docker compose -f "$ROOT_DIR/docker/docker-compose.yml" up postgres minio minio-init -d
fi

# ── 3. Node deps + Prisma ──────────────────────────────────────────────────
if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "[dev] Installing Node dependencies..."
  (cd "$ROOT_DIR" && pnpm install)
fi

# Generate Prisma client if missing
if [ ! -d "$ROOT_DIR/node_modules/.prisma/client" ]; then
  echo "[dev] Generating Prisma client..."
  (cd "$ROOT_DIR" && pnpm db:generate)
fi

# Push schema to DB (idempotent — safe to run every time)
echo "[dev] Syncing database schema..."
(cd "$ROOT_DIR" && pnpm db:push 2>/dev/null) || echo "[dev] Warning: db:push failed (database may be unavailable)"

# ── 4. Python venv + FastAPI ────────────────────────────────────────────────
PYTHON=""
for candidate in python3.12 python3.13 python3.11 python3; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "[dev] Error: Python not found. Install Python 3.12: brew install python@3.12"
  exit 1
fi

# Kill any existing process on port 4000
existing_pid=$(lsof -ti:4000 2>/dev/null || true)
if [ -n "$existing_pid" ]; then
  kill $existing_pid 2>/dev/null || true
  sleep 1
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "[dev] Creating Python venv ($PYTHON)..."
  "$PYTHON" -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --quiet -r "$API_DIR/requirements.txt"
  echo "[dev] Python dependencies installed."
fi

echo "[dev] Starting FastAPI on :4000..."
"$VENV_DIR/bin/uvicorn" main:socket_app \
  --host 0.0.0.0 --port 4000 \
  --app-dir "$API_DIR" \
  --reload --reload-dir "$API_DIR" &
PIDS+=($!)

# Wait a moment for FastAPI to boot
sleep 2

# ── 5. Next.js ──────────────────────────────────────────────────────────────
echo "[dev] Starting Next.js on :3000..."
(cd "$ROOT_DIR" && pnpm --filter @ai-app-builder/web dev) &
PIDS+=($!)

# ── Ready ───────────────────────────────────────────────────────────────────
echo ""
echo "  ✓ Web:      http://localhost:3000"
echo "  ✓ API:      http://localhost:4000"
echo "  ✓ Health:   http://localhost:4000/health"
echo "  ✓ Database: postgresql://localhost:5432/ai_app_builder"
echo ""

# Wait for any child to exit
wait
