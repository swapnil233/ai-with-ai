# AI App Builder

An AI-powered app builder with a chat interface for generating and deploying applications.

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + Vercel AI SDK v5 + shadcn/ui + Tailwind CSS
- **Backend**: Express.js + Socket.io
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: better-auth
- **Sandboxing**: Modal (planned)
- **Monorepo**: pnpm workspaces + Turborepo
- **Containerization**: Docker Compose

## Project Structure

```
ai-with-ai/
├── apps/
│   ├── web/                    # Next.js frontend
│   └── api/                    # Express.js backend
├── packages/
│   └── shared/                 # Shared types & utilities
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.web
│   └── Dockerfile.api
└── scripts/
    └── dev.sh
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Run the dev script - handles everything automatically
./scripts/dev.sh
```

This will:

- Install dependencies
- Start PostgreSQL, API, and Web containers
- Set up the database

### Option 2: Manual Setup

1. Install dependencies:

```bash
pnpm install
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your values
```

3. Start PostgreSQL (using Docker):

```bash
cd docker && docker compose up postgres -d
```

4. Run database migrations:

```bash
pnpm db:push
```

5. Start development servers:

```bash
pnpm dev
```

## Services

| Service  | URL                          |
| -------- | ---------------------------- |
| Web      | http://localhost:3000        |
| API      | http://localhost:4000        |
| Health   | http://localhost:4000/health |
| Database | postgresql://localhost:5432  |

## Scripts

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `pnpm dev`         | Start all services in dev mode |
| `pnpm build`       | Build all packages             |
| `pnpm lint`        | Lint all packages              |
| `pnpm db:push`     | Push schema to database        |
| `pnpm db:migrate`  | Run database migrations        |
| `pnpm db:generate` | Generate Prisma client         |

## Environment Variables

See `.env.example` for all available environment variables.

### Required Variables

| Variable                                | Description               |
| --------------------------------------- | ------------------------- |
| `DATABASE_URL`                          | PostgreSQL connection URL |
| `BETTER_AUTH_SECRET`                    | Auth secret key           |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | AI provider key           |

## Development

### Adding UI Components

```bash
cd apps/web
npx shadcn@latest add [component-name]
```

### Database Changes

1. Edit `apps/api/prisma/schema.prisma`
2. Run `pnpm db:push` (dev) or `pnpm db:migrate` (production)

### Adding Shared Types

1. Edit `packages/shared/src/index.ts`
2. Run `pnpm --filter @ai-app-builder/shared build`
