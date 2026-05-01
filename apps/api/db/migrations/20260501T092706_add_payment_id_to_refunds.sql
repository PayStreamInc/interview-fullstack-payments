-- add_payment_id_to_refunds

BEGIN;

ALTER TABLE refunds ADD COLUMN payment_id uuid;

COMMIT;
