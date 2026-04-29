-- add_refund_claims
-- Stores ACH claim details submitted by users, with account number encrypted at rest.

BEGIN;

CREATE TABLE IF NOT EXISTS refund_claims (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id                uuid        NOT NULL REFERENCES refunds(id),
  account_holder_name      text        NOT NULL,
  routing_number           text        NOT NULL,
  account_number_encrypted text        NOT NULL,
  account_type             text        NOT NULL CHECK (account_type IN ('checking', 'savings')),
  created_at               timestamptz NOT NULL DEFAULT now()
);

COMMIT;
