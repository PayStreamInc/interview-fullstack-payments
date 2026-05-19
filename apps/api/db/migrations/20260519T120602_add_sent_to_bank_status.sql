-- add_sent_to_bank_status
-- Add 'sent_to_bank' to the allowed refund statuses.

BEGIN;

ALTER TABLE refunds DROP CONSTRAINT refunds_status_check;

ALTER TABLE refunds
  ADD CONSTRAINT refunds_status_check
  CHECK (status IN ('unclaimed', 'pending', 'sent_to_bank', 'failed', 'completed'));

COMMIT;
