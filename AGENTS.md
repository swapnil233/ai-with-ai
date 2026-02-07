# Repository Guidelines

## Product Context

- This repository is an **AI app builder**. Users describe what they want in chat, and the system generates and iterates on real applications.
- The product aims to build full-stack apps (frontend, backend, database, auth), not just UI snippets.
- `apps/web` is the control-plane UI where users chat, inspect output, and manage projects. It also hosts better-auth for same-origin authentication.
- `services/api` is the FastAPI backend for CRUD operations (projects, users), security (CSRF), sandbox orchestration (Modal), and real-time communication (Socket.io).
- Generated apps run in isolated sandbox infrastructure (Modal) for preview/build execution, while durable state (project metadata, code versions, long-lived data, uploaded assets) is kept outside ephemeral runtimes.
- When making changes, optimize for this workflow: **prompt -> generation -> sandbox preview -> persist -> resume later**.

## Project Structure & Module Organization

- `apps/web`: Next.js 16 frontend (App Router) + better-auth (same-origin). Main code in `apps/web/src/app`, `apps/web/src/components`, and `apps/web/src/lib`. Auth route handler at `apps/web/src/app/api/auth/[...all]/route.ts`. API requests to `/api/projects`, `/api/user`, `/api/security`, `/sandbox` are proxied to FastAPI via Next.js rewrites in `next.config.ts`.
- `services/api`: FastAPI (Python 3.12) backend. `main.py` is the app entrypoint with middleware and Socket.io mount. Routes in `routes/`, SQLAlchemy models in `models/`, auth/db dependencies in `dependencies/`, middleware in `middleware/`, Socket.io in `ws/`, tests in `tests/`.
- `packages/database`: Shared Prisma schema (`prisma/schema.prisma`), migrations, and client singleton (`src/index.ts`). Both Next.js and FastAPI use the same database.
- `packages/shared`: Shared TypeScript utilities/types published from `packages/shared/src` to `packages/shared/dist`.
- Local infra in `docker/docker-compose.yml` includes PostgreSQL and MinIO (S3-compatible object storage).
- Root tooling: Turborepo (`turbo.json`), Husky hooks (`.husky/`), lint-staged (`lint-staged.config.mjs`), and commitlint (`commitlint.config.mjs`).

## Build, Test, and Development Commands

- `pnpm dev`: Start everything (Docker, FastAPI, Next.js) via `scripts/dev.sh`.
- `pnpm build` / `pnpm lint` / `pnpm test`: Build, lint, or test all JS/TS packages.
- `pnpm --filter @ai-app-builder/web dev`: Run only the web app.
- `pnpm --filter @ai-app-builder/web test`: Run only web tests.
- `cd services/api && source .venv/bin/activate && pytest tests/ -v`: Run FastAPI Python tests.
- `pnpm db:start`: Start local Postgres + MinIO via Docker Compose.
- `pnpm db:push` / `pnpm db:migrate` / `pnpm db:generate`: Prisma schema sync, migrations, and client generation (targets `packages/database`).
- `pnpm format`: Format `ts/tsx/js/jsx/json/md` files with Prettier.

## Coding Style & Naming Conventions

- **TypeScript** (strict mode): 2-space indentation, semicolons, double quotes, max line width 100 (Prettier). Use kebab-case filenames (e.g., `chat-input.tsx`) and PascalCase React component exports.
- **Python** (services/api): Follow standard Python conventions. Use type hints. Pydantic models for request validation. SQLAlchemy models must mirror Prisma schema exactly (PascalCase table names, camelCase column names).

## Key Architecture Patterns

- **Auth flow**: better-auth runs in Next.js (same-origin). It sets a signed cookie `better-auth.session_token` with format `TOKEN.HMAC_SIGNATURE`. FastAPI validates sessions by extracting the plain token (split on last `.`), then querying the `Session` table. The DB stores plain tokens, not hashes. See `dependencies/auth.py`.
- **API proxying**: Next.js rewrites proxy `/api/projects`, `/api/user`, `/api/security`, `/sandbox`, `/health` to FastAPI at `:4000`. Frontend code uses relative URLs (empty `API_BASE_URL`). This avoids cross-origin cookie issues.
- **Database sharing**: Prisma owns DDL (schema, migrations) in `packages/database`. SQLAlchemy reads/writes the same tables. `DATABASE_URL` uses `postgresql://`; FastAPI's `config.py` auto-converts to `postgresql+asyncpg://`. Never use Alembic.
- **Route paths**: FastAPI routes use empty-string paths (`@router.get("")`) not `"/"` to avoid 307 trailing-slash redirects that break cookie forwarding.
- **Datetime columns**: Prisma uses `TIMESTAMP WITHOUT TIME ZONE`. Python code must pass naive UTC datetimes (`datetime.now(timezone.utc).replace(tzinfo=None)`), not timezone-aware ones. asyncpg rejects the mismatch.
- **CSRF exemptions**: `/sandbox/*` paths are exempt from CSRF (server-to-server calls from Next.js chat tools). See `middleware/csrf.py`.
- **Sandbox tool calls**: Chat tools in `apps/web/src/app/api/chat/tools.ts` call FastAPI sandbox endpoints directly using `API_URL` (not browser-proxied). The sandbox manager (`services/sandbox_manager.py`) creates parent directories with `mkdir -p` before writing files.
- **Error format**: All API errors return `{"error": "message"}` JSON.

## Testing Guidelines

- **Web**: Vitest with `jsdom` + React Testing Library. Tests co-located as `*.test.{ts,tsx}`.
- **FastAPI**: pytest + httpx AsyncClient + aiosqlite (in-memory SQLite). Tests in `services/api/tests/`. Test auth fixtures use `TOKEN.fakesignature` cookie format with plain token in DB.
- Run `pnpm test` (JS/TS) and `pytest` (Python) before opening a PR.

## Commit & Pull Request Guidelines

- Commit format is Conventional Commits (e.g., `feat:`, `fix:`, `chore:`); enforced by commitlint.
- Pre-commit runs lint-staged + targeted Turbo tests; pre-push runs type checks, shared build, full tests, and lint.
- PRs should include: concise summary, linked issue (if applicable), test evidence, and UI screenshots for visible web changes.

## Security & Configuration Tips

- Copy `.env.example` to `.env` and keep secrets out of git.
- Required local values include `DATABASE_URL`, `BETTER_AUTH_SECRET`, `OPENAI_API_KEY`, and S3 settings (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`).
