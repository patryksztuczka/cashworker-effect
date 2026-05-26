# Cashworker Effect

pnpm/Turborepo monorepo with:

- `apps/backend`: Hono on Cloudflare Workers, Effect, Drizzle ORM, D1, Vitest.
- `apps/web`: React, Vite, React Router, TanStack Query, Tailwind CSS, Vitest, Playwright.
- Root tooling: oxlint, oxfmt, TypeScript, GitHub Actions CI.
- Local SMTP: Mailpit through Docker Compose.

## Commands

```sh
pnpm install
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

## Backend

```sh
pnpm --filter @cashworker/backend dev
pnpm --filter @cashworker/backend db:generate
pnpm --filter @cashworker/backend db:migrate:local
```

Replace the placeholder D1 `database_id` in `apps/backend/wrangler.jsonc` before deploying.
For remote Drizzle operations, set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, and
`CLOUDFLARE_D1_TOKEN`.

## Web

```sh
pnpm --filter @cashworker/web dev
pnpm --filter @cashworker/web e2e
```

The Playwright config starts the Vite dev server automatically for e2e tests.

## Mailpit

```sh
docker compose up mailpit
```

SMTP runs on `localhost:1025`; the Mailpit UI runs on `http://localhost:8025`.
