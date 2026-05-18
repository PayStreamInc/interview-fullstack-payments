# Interview Fullstack Payments

Minimal fullstack scaffold for a senior interview exercise around ACH refund claims.

## Stack

- Web: Vite, React, TypeScript, Tailwind, shadcn/ui
- API: Express, TypeScript, PostgreSQL, SFTP client
- Bank: TypeScript worker that reads outbound CSVs and writes response CSVs
- Infra: Docker Compose with Postgres, SFTP, API, web, and bank

## Setup

```sh
npm install
docker compose up --build
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3000`
- API health: `curl http://127.0.0.1:3000/health`
- SFTP smoke: `curl -X POST http://127.0.0.1:3000/dev/sftp-test`
- Payment cron logs: `docker compose logs -f payment-cron`

Postgres client:

```txt
postgres://payments:payments@127.0.0.1:25432/payments
```

SFTP from host:

```txt
127.0.0.1:2222 / payments / payments
```

## Payment Cron Scaffold

The `payment-cron` Docker service runs `apps/api/src/jobs/paymentCron.ts` with live reload via `tsx watch`.

```sh
docker compose up --build payment-cron
```

## Payment Processing Exercise

After a refund is claimed, the system needs to eventually send an ACH payment request to the bank simulator and apply the bank response.

```txt
unclaimed refund
    |
    | user submits valid ACH claim
    v
pending
    |
    | cron includes payment in outbound CSV
    v
pending
    |
    | bank response row is accepted
    v
completed

sent to bank, waiting for response
    |
    | bank response row is rejected
    v
failed
```

## Bank Simulator

The `bank` service watches `sftp/upload/outbound` every 3 seconds, writes responses to `sftp/upload/inbound`, and archives processed inputs to `sftp/upload/archive`.

Input CSV columns:

```txt
payment_id,refund_id,amount_cents,currency,routing_number,account_number,account_holder_name,account_type
```

Response CSV columns:

```txt
payment_id,refund_id,status,reason,processed_at
```

Invalid rows return `status=rejected` with a reason. Logs: `docker compose logs -f bank`.

## Migrations

```sh
npm run migration:create -- add_claimed_at_to_refunds
npm run migration:run -- latest
npm run migration:run -- <migration-file>.sql
```

Migrations are plain SQL files in `apps/api/db/migrations`. If a migration changes base schema, update `apps/api/db/init.sql` too.

Source is bind-mounted into Docker for API, web, and bank. If watchers miss a change:

```sh
docker compose restart api web bank
```

After dependency or Dockerfile changes:

```sh
docker compose up -d --build api web bank
```

Reset DB and recreate the full stack:

```sh
npm run db:reset
```

This deletes local Postgres Docker volume data.
