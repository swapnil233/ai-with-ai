# Repository Guidelines

## Product Context

- This repository is an **AI app builder**. Users describe what they want in chat, and the system generates and iterates on real applications.
- The product aims to build full-stack apps (frontend, backend, database, auth), not just UI snippets.
- `apps/web` is the control-plane UI where users chat, inspect output, and manage projects.
- `apps/api` is the control-plane backend for auth, project/chat state, and orchestration.
- Generated apps are intended to run in isolated sandbox infrastructure (for example Modal) for preview/build execution, while durable state (project metadata, code versions, long-lived data) is kept outside ephemeral runtimes.
- When making changes, optimize for this workflow: **prompt -> generation -> sandbox preview -> persist -> resume later**.

## Project Structure & Module Organization

- `apps/web`: Next.js frontend (App Router). Main code lives in `apps/web/src/app`, `apps/web/src/components`, and `apps/web/src/lib`; static assets are in `apps/web/public`.
- `apps/api`: Express + Prisma backend. Route and middleware code is in `apps/api/src/routes` and `apps/api/src/middleware`; database schema is in `apps/api/prisma/schema.prisma`.
- `packages/shared`: Shared TypeScript utilities/types published from `packages/shared/src` to `packages/shared/dist`.
- Root tooling: Turborepo (`turbo.json`), Husky hooks (`.husky/`), lint-staged (`lint-staged.config.mjs`), and commitlint (`commitlint.config.mjs`).

## Build, Test, and Development Commands

- `pnpm dev`: Run all workspace dev servers through Turbo.
- `pnpm build` / `pnpm lint` / `pnpm test`: Build, lint, or test all packages.
- `pnpm --filter @ai-app-builder/web dev`: Run only the web app.
- `pnpm --filter @ai-app-builder/api dev`: Run only the API.
- `pnpm db:start`: Start local Postgres via Docker Compose.
- `pnpm db:push` / `pnpm db:migrate` / `pnpm db:generate`: Prisma schema sync, migrations, and client generation.
- `pnpm format`: Format `ts/tsx/js/jsx/json/md` files with Prettier.

## Coding Style & Naming Conventions

- Language: TypeScript (strict mode enabled across apps/packages).
- Formatting (Prettier): 2-space indentation, semicolons, double quotes, max line width 100.
- Linting: ESLint in each package (`eslint-config-next` for web, `typescript-eslint` for API/shared).
- Naming: Use kebab-case filenames (for example `chat-input.tsx`) and PascalCase React component exports.

## Testing Guidelines

- Framework: Vitest across the monorepo.
- Web tests: `apps/web/src/**/*.test.{ts,tsx}` with `jsdom` + Testing Library.
- API tests: `apps/api/src/**/*.test.ts` with Node environment.
- Run `pnpm test` before opening a PR; use `pnpm --filter @ai-app-builder/web test:coverage` (or API equivalent) when validating coverage-sensitive changes.

## Commit & Pull Request Guidelines

- Commit format is Conventional Commits (for example `feat:`, `fix:`, `chore:`); enforced by commitlint.
- Pre-commit runs lint-staged + targeted Turbo tests; pre-push runs type checks, shared build, full tests, and lint.
- PRs should include: concise summary, linked issue (if applicable), test evidence, and UI screenshots for visible web changes.

## Security & Configuration Tips

- Copy `.env.example` to `.env` and keep secrets out of git.
- Required local values include `DATABASE_URL`, `BETTER_AUTH_SECRET`, and an AI provider key (for example `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`).
