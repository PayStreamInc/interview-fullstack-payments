-- add_refund_payment_details

BEGIN;

ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS account_holder_name text,
  ADD COLUMN IF NOT EXISTS routing_number text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS account_type text CHECK (account_type IN ('checking', 'savings'));

COMMIT;
