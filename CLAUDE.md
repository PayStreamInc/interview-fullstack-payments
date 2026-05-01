# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# Start the full stack (preferred)
npm install && docker compose up --build

# Individual workspace commands (run from root)
npm run dev          # run all dev servers
npm run build        # build all packages
npm run typecheck    # type check all packages
npm run format       # format with Prettier (100 char width, trailing commas)

# Database
npm run migration:create -- <migration_name>   # create timestamped SQL migration
npm run migration:run -- latest                # run all pending migrations
npm run migration:run -- <file>.sql            # run specific migration
npm run db:reset                              # delete Docker volumes and recreate stack

# Docker (useful for development)
docker compose logs -f payment-cron           # tail cron job logs
docker compose logs -f bank                   # tail bank simulator logs
docker compose restart api web bank           # restart services if hot reload missed changes
docker compose up -d --build api web bank     # rebuild specific services
```

There is no test suite. Type checking (`npm run typecheck`) is the primary correctness check.

## Architecture

This is a monorepo (`npm workspaces`) implementing an ACH refund claims processing system.

### Workspace layout

- `apps/api` — Express + TypeScript backend (port 3000)
- `apps/web` — React + Vite + Tailwind/shadcn frontend (port 5173)
- `apps/bank` — Bank simulator worker (processes CSV files)
- `packages/shared` — Shared Zod schemas and TypeScript types

All services run in Docker Compose. PostgreSQL is on port 25432, SFTP on port 2222.

### Data flow

```
Web → POST /refunds/:id/claim → API → DB (status: pending)
                                          ↓
                              payment-cron → writes CSV to SFTP outbound/
                                          ↓
                              Bank simulator reads CSV, writes response to SFTP inbound/
                                          ↓
                              payment-cron reads response → DB (status: paid | failed)
```

### Refund status lifecycle

`unclaimed` → `pending` → `exported` → `paid` | `failed`

### Key files

| File | Purpose |
|------|---------|
| `apps/api/src/server.ts` | Express routes (`/health`, `/refunds`, `/refunds/:id/claim`) |
| `apps/api/src/db.ts` | PostgreSQL pool and row mappers |
| `apps/api/src/sftp.ts` | SFTP client wrapper (list, upload, download) |
| `apps/api/src/services/paymentCronService.ts` | Cron tick logic — currently a stub |
| `apps/api/src/services/paymentCsv.ts` | CSV serialization/deserialization — stub |
| `apps/api/src/jobs/paymentCron.ts` | Cron entry point (supports `--once` flag) |
| `apps/api/db/init.sql` | Schema definition and 4 seed refund records |
| `apps/bank/src/worker.ts` | Polls SFTP outbound every 3 s, validates rows, writes responses |
| `packages/shared/src/index.ts` | `Refund`, `ClaimRefundRequest` Zod schemas, `RefundStatus` enum |

### SFTP directory convention

| Path | Owner | Content |
|------|-------|---------|
| `sftp/upload/outbound/` | API (cron) writes | Payment CSVs to be processed |
| `sftp/upload/inbound/` | Bank writes | Response CSVs with `accepted`/`rejected` status |
| `sftp/upload/archive/` | Bank archives | Processed input files |

### CSV formats

**Outbound (API → Bank):** `payment_id, refund_id, amount_cents, currency, routing_number, account_number, account_holder_name, account_type`

**Inbound (Bank → API):** `payment_id, refund_id, status, reason, processed_at`

### Shared package

`packages/shared` is the single source of truth for types. `ClaimRefundRequest` validates: `accountHolderName`, `routingNumber` (9 digits), `accountNumber` (4–17 digits), `accountType` (checking | savings).

### Environment

Copy `.env.example` to `.env`. Default DB: `postgres://payments:payments@127.0.0.1:25432/payments`. Cron interval controlled by `PAYMENT_CRON_INTERVAL_MS` (default 5000 ms).

### Interview context

The `POST /refunds/:id/claim` endpoint is intentionally a 501 stub. The exercise is to implement the full flow: claim endpoint → DB update → cron picks up pending refunds → CSV to SFTP → read bank responses → update status.
