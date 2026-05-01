-- add_claim_details_to_refunds

BEGIN;

ALTER TABLE refunds
  ADD COLUMN account_holder_name text,
  ADD COLUMN routing_number char(9),
  ADD COLUMN account_number varchar(17),
  ADD COLUMN account_type text CHECK (account_type IN ('checking', 'savings'));

COMMIT;
