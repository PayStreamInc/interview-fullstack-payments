-- add_idempotency_keys

BEGIN;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key             text        PRIMARY KEY,
  refund_id       uuid        NOT NULL REFERENCES refunds(id),
  response_status integer     NOT NULL,
  response_body   jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMIT;
