---
name: database-cli
description: Explains and operates the project database CLI for migrations, resets, psql inspection, and client connection strings. Use when working in this payments interview project and the user asks about database migrations, resetting the database, psql, Postgres access, or candidate DB commands.
---

# Database CLI

## Quick Start

Create a migration:

```sh
npm run migration:create -- add_claimed_at_to_refunds
```

Run the latest migration:

```sh
npm run migration:run -- latest
```

Reset the database and recreate the stack:

```sh
npm run db:reset
```

## Connection Info

Use this connection string for local PostgreSQL clients:

```txt
postgres://payments:payments@127.0.0.1:25432/payments
```

Equivalent fields:

- Host: `127.0.0.1`
- Port: `25432`
- Database: `payments`
- User: `payments`
- Password: `payments`

## Workflows

When the user wants to add a schema change:

1. Run `npm run migration:create -- <descriptive_name>`.
2. Edit the generated SQL file in `apps/api/db/migrations`.
3. Run `npm run migration:run -- latest`.
4. If the schema should exist after a fresh reset, update `apps/api/db/init.sql` too.

When the user wants to run a specific migration:

```sh
npm run migration:run -- 20260428T214049_add_claimed_at_to_refunds.sql
```

When the user wants a clean database:

```sh
npm run db:reset
```

This deletes Docker volumes, rebuilds images, starts services, and re-runs `apps/api/db/init.sql`.

When the user wants to inspect the database from the terminal:

```sh
docker compose exec postgres psql -U payments -d payments
```

Useful psql commands:

```txt
\dt
\d refunds
SELECT * FROM refunds;
\q
```

## Guardrails

- Keep migrations as plain SQL; do not add a migration framework unless explicitly requested.
- Prefer `npm run migration:run -- latest` over piping SQL manually.
- Warn before `npm run db:reset` because it deletes local Postgres data.
- If a migration updates the base schema, keep `apps/api/db/init.sql` in sync.
