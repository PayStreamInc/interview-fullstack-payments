-- add_idempotency_keys
-- Stores processed idempotency keys to prevent duplicate claim submissions.

BEGIN;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         uuid        PRIMARY KEY,
  refund_id   uuid        NOT NULL REFERENCES refunds(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMIT;
