# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A deliberately incomplete scaffold for a senior fullstack interview exercise around ACH refund claims. **Two pieces are intentionally left unimplemented as the candidate's task** — do not "fix" them unless asked:

- `POST /refunds/:id/claim` returns `501` (`apps/api/src/server.ts`). It validates the body with `claimRefundRequestSchema` but does not persist the claim.
- `runPaymentCronOnce()` in `apps/api/src/services/paymentCronService.ts` only logs. It is meant to build outbound CSVs, upload via SFTP, and apply bank responses.

The supporting infrastructure (SFTP client, CSV codec, bank simulator, cron loop, DB pool, migrations CLI) is complete and working.

## Commands

Everything runs in Docker Compose; there is no host-side dev server flow.

```sh
npm install
docker compose up --build          # full stack
docker compose logs -f payment-cron # cron output
docker compose logs -f bank         # bank simulator output
docker compose restart api web bank # if a file watcher misses a bind-mounted change
docker compose up -d --build api web bank # after dependency/Dockerfile changes
```

- `npm run typecheck` / `npm run build` / `npm run format` / `npm run format:check` — run across all workspaces.
- There is **no test runner configured** in any workspace. Do not invent a `npm test` command.
- Migrations (require the `postgres` container running, since `migration:run` shells into it via `docker compose exec`):
  ```sh
  npm run migration:create -- add_claimed_at_to_refunds   # scaffolds apps/api/db/migrations/<ts>_<slug>.sql
  npm run migration:run -- latest                          # or -- <file>.sql
  npm run db:reset                                          # destroys the pgdata volume, rebuilds, re-runs init.sql
  ```
- Postgres from host: `postgres://payments:payments@127.0.0.1:25432/payments`. Inside Docker the host/port differ (`postgres:5432`, SFTP `sftp:22` vs host `2222`).

## Architecture

Five Compose services; an npm-workspaces monorepo (`apps/*`, `packages/*`).

- **`apps/web`** — Vite + React + Tailwind + shadcn/ui. Talks to the API over HTTP only (`VITE_API_URL`).
- **`apps/api`** — Express. Serves unclaimed refunds, the claim endpoint, and an SFTP smoke test. Also the image for the `payment-cron` service, which runs `apps/api/src/jobs/paymentCron.ts` (a `setInterval` loop with a re-entrancy guard) instead of the server.
- **`apps/bank`** — A file-watching worker, **not** an SFTP client. It is the counterparty simulator.
- **`packages/shared`** — Zod schemas/types shared by web and api. This is the API contract; change request/response shapes here, not ad hoc.

### The payment flow (the point of the exercise)

`refunds.status` moves `unclaimed → pending → completed | failed` (constraint in `apps/api/db/init.sql`):

1. User submits a valid ACH claim → refund goes `pending` (the part to implement).
2. The cron selects pending refunds, writes an outbound CSV, and `uploadSftpFile` puts it in `upload/outbound`.
3. The bank simulator polls, validates each row, writes a `*.response.csv` to `upload/inbound`, and archives the input.
4. The cron downloads the response and maps each row to `completed`/`failed`.

### Non-obvious wiring

- **The SFTP server and the bank share a volume.** The API speaks real SFTP to the `sftp` container's `upload/{outbound,inbound}`. The host dir `sftp/upload/` is bind-mounted into *both* the `sftp` container and the `bank` container (as `/sftp`). The bank never uses SFTP — it reads/writes files directly on that shared volume. This is how the two halves meet.
- **The CSV contract is defined twice and must stay in sync:** the API side in `apps/api/src/services/paymentCsv.ts` (both directions) and the bank side in `apps/bank/src/worker.ts`. Outbound columns: `payment_id,refund_id,amount_cents,currency,routing_number,account_number,account_holder_name,account_type`. Response columns: `payment_id,refund_id,status,reason,processed_at`.
- **Status vocabulary differs by layer:** the bank/CSV response uses `accepted`/`rejected`; the `refunds` table uses `completed`/`failed`. The cron is responsible for the mapping.
- `apps/api/src/sftp.ts` confines all remote paths under `SFTP_REMOTE_DIR` and rejects path traversal / non-basename filenames — keep new SFTP calls going through `uploadSftpFile`/`downloadSftpFile`.
- All env access is centralized in `apps/api/src/env.ts` with defaults; read config from `env`, not `process.env`.

## Conventions

- **ESM throughout** (`"type": "module"`). In api/bank source, relative imports of local `.ts` files use a `.js` extension (e.g. `import { env } from "./env.js"`). Match this when adding files.
- TypeScript is `strict`; all workspaces extend `tsconfig.base.json`.
- Migrations are **plain SQL only** — do not introduce a migration framework. If a migration changes base schema, also update `apps/api/db/init.sql` so a fresh `db:reset` reproduces it.
- Source is bind-mounted with `tsx watch` live reload (`CHOKIDAR_USEPOLLING=true`); code changes generally do not need a rebuild, dependency/Dockerfile changes do.
- A project skill exists at `.agents/skills/database-cli/SKILL.md` covering DB/migration operations.
