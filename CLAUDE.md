# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this app?

This is an **AI-powered no-code application builder**. Users can create applications by describing what they want in natural language (ChatGPT-style interface) rather than traditional drag-and-drop.

**How it works:**

- Users chat with an LLM to describe the app they want to build
- Each project gets its own isolated sandbox environment powered by **Modal**
- The AI generates and deploys the application within that sandbox
- Authentication and authorization handled via **better-auth** (same-origin on Next.js)

**Key integrations:**

- **Modal** - Sandbox environments for running user-created applications
- **OpenAI/Anthropic API** - LLM provider(s) for understanding user intent and generating code
- **better-auth** - User authentication and authorization (runs in Next.js)
- **MinIO (S3-compatible)** - Local object storage for generated assets/artifacts

## Build & Development Commands

```bash
# Development (starts FastAPI + Next.js via Turborepo)
pnpm dev

# Build all packages
pnpm build

# Lint and format
pnpm lint
pnpm format

# Testing
pnpm test                                    # Run all JS/TS tests once
pnpm test:watch                              # Watch mode
pnpm --filter @ai-app-builder/web test       # Web tests only

# Python API tests
cd services/api && .venv/bin/pytest          # Run FastAPI tests

# Run a single test file
pnpm --filter @ai-app-builder/web test src/lib/utils.test.ts

# Adding UI components (shadcn)
cd apps/web && npx shadcn@latest add [component-name]

# Database (requires DATABASE_URL in .env)
pnpm db:start                                        # Start PostgreSQL + MinIO
pnpm db:generate                                     # Generate Prisma client
pnpm db:push                                         # Push schema to database
pnpm db:migrate                                      # Run migrations
pnpm --filter @ai-app-builder/database db:studio     # Open Prisma Studio

# Docker setup (recommended for first-time setup)
./scripts/dev.sh
```

## Architecture

```
Browser → Next.js (:3000)
            ├─ /api/auth/*     → better-auth (same-origin, Prisma via packages/database)
            ├─ /api/chat       → Vercel AI SDK → Anthropic
            │                     └─ tool calls → FastAPI (:4000) /sandbox/*
            └─ fetch           → FastAPI (:4000)
                                    ├─ /api/projects, /api/user, /api/security
                                    ├─ /sandbox/* (create, write-files, run-command, tunnel-url, terminate)
                                    └─ Socket.io (python-socketio)
```

**Monorepo Structure:**

- `apps/web` - Next.js 16 frontend + better-auth (port 3000)
- `services/api` - FastAPI backend with Socket.io (port 4000)
- `packages/database` - Shared Prisma schema, migrations, and client singleton
- `packages/shared` - Shared TypeScript types for API contracts

**Key Technologies:**

- **Frontend**: Next.js App Router, React 19, Tailwind CSS v4, shadcn/ui components, Vercel AI SDK
- **Backend**: FastAPI (Python), python-socketio for real-time, SQLAlchemy (async) for DB access
- **Database**: PostgreSQL for relational data, Prisma owns schema/migrations, SQLAlchemy reads/writes
- **Storage**: MinIO (S3-compatible) for object storage
- **AI/Sandbox**: LLM provider via API keys, Modal for isolated sandbox environments
- **Auth**: better-auth in Next.js (same-origin cookies), FastAPI validates session cookie directly
- **Build**: pnpm workspaces + Turborepo for task orchestration and caching

**Path Aliases:**

- Web uses `@/*` → `./src/*` (e.g., `import { cn } from "@/lib/utils"`)

**FastAPI Structure (`services/api/`):**

- `main.py` - FastAPI app + middleware + Socket.io ASGI mount
- `config.py` - Pydantic Settings from env vars
- `models/` - SQLAlchemy models (mirror Prisma schema exactly)
- `routes/` - Route handlers (health, user, projects, security, sandbox)
- `middleware/` - Security headers, rate limiting, CSRF, request ID
- `dependencies/` - Auth (session cookie validation), DB session
- `services/` - Sandbox manager (Modal), audit logging
- `socket/` - python-socketio server with session-based auth
- `tests/` - pytest + httpx async tests

**Database Sharing:** Prisma owns DDL (schema/migrations) in `packages/database`. SQLAlchemy in FastAPI reads/writes the same PostgreSQL tables. Both use `DATABASE_URL`. No Alembic needed.

**Shared Types:**
The `@ai-app-builder/shared` package exports User, Project, Chat, Message types, API response wrappers, and WebSocket event types. Build shared package first when types change (`pnpm --filter @ai-app-builder/shared build`).

## Testing

- **Web**: Tests co-located with source files (`*.test.ts`, `*.test.tsx`). Uses Vitest with jsdom and React Testing Library.
- **FastAPI**: Tests in `services/api/tests/`. Uses pytest + httpx AsyncClient + aiosqlite (in-memory SQLite for speed).

## Git Workflow

- Husky runs lint-staged on pre-commit (Prettier + ESLint)
- Pre-push runs type checks and full test suite
- Commits must follow conventional format: `feat:`, `fix:`, `docs:`, etc.

## Environment Variables

Required in `.env` (copy from `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string (Prisma uses standard `postgresql://`, FastAPI uses `postgresql+asyncpg://`)
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` - Authentication (better-auth runs in Next.js)
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` - LLM provider key
- `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` - Modal API for sandbox environments
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` - Frontend API endpoints
- `SANDBOX_SERVICE_URL` - Sandbox service URL (defaults to `http://localhost:4000`)
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` - S3-compatible object storage config
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` - Local MinIO bootstrap credentials
