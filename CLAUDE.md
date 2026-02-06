# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this app?

This is an **AI-powered no-code application builder**. Users can create applications by describing what they want in natural language (ChatGPT-style interface) rather than traditional drag-and-drop.

**How it works:**

- Users chat with an LLM to describe the app they want to build
- Each project gets its own isolated sandbox environment powered by **Modal**
- The AI generates and deploys the application within that sandbox
- Authentication and authorization handled via **better-auth**

**Key integrations:**

- **Modal** - Sandbox environments for running user-created applications
- **OpenAI/Anthropic API** - LLM provider(s) for understanding user intent and generating code
- **better-auth** - User authentication and authorization
- **MinIO (S3-compatible)** - Local object storage for generated assets/artifacts

## Build & Development Commands

```bash
# Development (starts all services via Turborepo)
pnpm dev

# Build all packages
pnpm build

# Lint and format
pnpm lint
pnpm format

# Testing
pnpm test                                    # Run all tests once
pnpm test:watch                              # Watch mode
pnpm --filter @ai-app-builder/api test       # API tests only
pnpm --filter @ai-app-builder/web test       # Web tests only

# Run a single test file
pnpm --filter @ai-app-builder/api test src/routes/health.test.ts
pnpm --filter @ai-app-builder/web test src/lib/utils.test.ts

# Adding UI components (shadcn)
cd apps/web && npx shadcn@latest add [component-name]

# Database (requires DATABASE_URL in .env)
pnpm db:start                                # Start PostgreSQL + MinIO
pnpm db:generate                             # Generate Prisma client
pnpm db:push                                 # Push schema to database
pnpm db:migrate                              # Run migrations
pnpm --filter @ai-app-builder/api db:studio  # Open Prisma Studio

# Docker setup (recommended for first-time setup)
./scripts/dev.sh
```

## Architecture

**Monorepo Structure:**

- `apps/web` - Next.js 16 frontend (port 3000)
- `apps/api` - Express.js 5 backend with Socket.io (port 4000)
- `packages/shared` - Shared TypeScript types for API contracts

**Key Technologies:**

- **Frontend**: Next.js App Router, React 19, Tailwind CSS v4, shadcn/ui components, Vercel AI SDK
- **Backend**: Express.js 5, Socket.io for real-time, Prisma ORM, better-auth for authentication, Zod validation
- **Storage**: PostgreSQL for relational data, MinIO (S3-compatible) for object storage
- **AI/Sandbox**: LLM provider via API keys, Modal for isolated sandbox environments
- **Build**: pnpm workspaces + Turborepo for task orchestration and caching

**Path Aliases:**

- Web uses `@/*` → `./src/*` (e.g., `import { cn } from "@/lib/utils"`)

**API Structure:**

- `src/app.ts` - Express app configuration (middleware, routes) - import this for testing
- `src/index.ts` - Server startup with Socket.io - avoid importing in tests
- `src/routes/` - Route handlers
- `src/lib/prisma.ts` - Database client singleton

**Important Pattern**: better-auth handler must be mounted BEFORE `express.json()` middleware (it handles its own body parsing).

**Shared Types:**
The `@ai-app-builder/shared` package exports User, Project, Chat, Message types, API response wrappers, and WebSocket event types. Build shared package first when types change (`pnpm --filter @ai-app-builder/shared build`).

## Testing

Tests are co-located with source files (`*.test.ts`, `*.test.tsx`). Uses Vitest with:

- **API**: Node environment, supertest for HTTP testing
- **Web**: jsdom environment, React Testing Library

## Git Workflow

- Husky runs lint-staged on pre-commit (Prettier + ESLint)
- Pre-push runs type checks and full test suite
- Commits must follow conventional format: `feat:`, `fix:`, `docs:`, etc.

## Environment Variables

Required in `.env` (copy from `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` - Authentication
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` - LLM provider key
- `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` - Modal API for sandbox environments
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` - Frontend API endpoints
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` - S3-compatible object storage config
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` - Local MinIO bootstrap credentials
