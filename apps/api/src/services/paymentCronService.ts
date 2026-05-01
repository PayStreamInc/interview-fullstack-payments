import { randomUUID } from "node:crypto";
import { pool, type PendingRefundRow } from "../db.js";
import { env } from "../env.js";
import { uploadSftpFile } from "../sftp.js";
import { createPaymentCsvFile, type PaymentCsvRow } from "./paymentCsv.js";

export async function runPaymentCronOnce(): Promise<void> {
  console.log("[cron] Payment cron tick started");

  // Revert any refunds that got stuck as 'exported' due to a process crash
  // between DB commit and SFTP upload on a previous tick.
  await recoverStuckExports();

  const { rows, paymentIds } = await lockAndMarkExported();

  if (rows.length === 0) {
    console.log("[cron] No pending refunds to export");
    return;
  }

  const csvRows: PaymentCsvRow[] = rows.map((row) => ({
    paymentId: paymentIds.get(row.id)!,
    refundId: row.id,
    amountCents: row.amount_cents,
    currency: row.currency,
    routingNumber: row.routing_number,
    accountNumber: row.account_number,
    accountHolderName: row.account_holder_name,
    accountType: row.account_type,
  }));

  const csvFile = createPaymentCsvFile(csvRows);
  console.log(`[cron] Generated "${csvFile.filename}" with ${csvFile.rowCount} payment(s)`);

  try {
    const remotePath = await uploadSftpFile(csvFile.filename, csvFile.contents);
    console.log(`[cron] Uploaded "${csvFile.filename}" to ${remotePath}`);
  } catch (uploadError) {
    console.error("[cron] SFTP upload failed, reverting exported refunds to pending:", uploadError);
    await revertToPending(rows.map((r) => r.id));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function lockAndMarkExported(): Promise<{
  rows: PendingRefundRow[];
  paymentIds: Map<string, string>;
}> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Only lock refunds that have all ACH fields present — incomplete rows are
    // left as 'pending' and picked up once their data is fixed.
    // SKIP LOCKED means a concurrent cron process (e.g. during rolling deploy)
    // sees zero rows rather than blocking.
    const { rows } = await client.query<PendingRefundRow>(
      `SELECT id, amount_cents, currency,
              account_holder_name, routing_number, account_number, account_type
       FROM refunds
       WHERE status = 'pending'
         AND account_holder_name IS NOT NULL
         AND routing_number IS NOT NULL
         AND account_number IS NOT NULL
         AND account_type IS NOT NULL
       FOR UPDATE SKIP LOCKED`,
    );

    if (rows.length === 0) {
      await client.query("COMMIT");
      return { rows: [], paymentIds: new Map() };
    }

    const paymentIds = new Map<string, string>(rows.map((row) => [row.id, randomUUID()]));
    const refundIds = rows.map((r) => r.id);
    const generatedIds = rows.map((r) => paymentIds.get(r.id)!);

    // Single round-trip batch UPDATE using parallel unnest — efficient for any
    // batch size. AND r.status = 'pending' is a defensive guard (the lock
    // already guarantees it within this transaction).
    await client.query(
      `UPDATE refunds AS r
       SET status = 'exported',
           payment_id = v.payment_id,
           updated_at = NOW()
       FROM (
         SELECT unnest($1::uuid[]) AS id,
                unnest($2::uuid[]) AS payment_id
       ) AS v
       WHERE r.id = v.id
         AND r.status = 'pending'`,
      [refundIds, generatedIds],
    );

    await client.query("COMMIT");
    console.log(`[cron] Locked and marked ${rows.length} refund(s) as exported`);

    return { rows, paymentIds };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      // If ROLLBACK itself fails the connection is dead; PostgreSQL rolls back
      // automatically when it detects the broken connection.
      console.error("[cron] ROLLBACK failed:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function revertToPending(refundIds: string[]): Promise<void> {
  try {
    await pool.query(
      `UPDATE refunds
       SET status = 'pending',
           payment_id = NULL,
           updated_at = NOW()
       WHERE id = ANY($1::uuid[])
         AND status = 'exported'`,
      [refundIds],
    );
    console.log(`[cron] Reverted ${refundIds.length} refund(s) to pending`);
  } catch (revertError) {
    // SFTP upload failed AND the revert also failed. The rows are stuck as
    // 'exported'. recoverStuckExports() will revert them on the next tick
    // after 2× the cron interval — this is self-healing.
    console.error(
      `[cron] CRITICAL: failed to revert ${refundIds.length} refund(s) to pending. ` +
        `They will be auto-recovered on the next tick. IDs: ${refundIds.join(", ")}`,
      revertError,
    );
  }
}

async function recoverStuckExports(): Promise<void> {
  // Revert 'exported' refunds whose updated_at is older than 2× the cron
  // interval. This handles process crashes between DB commit and SFTP upload.
  //
  // TRADEOFF: If the upload did complete but the process crashed before the
  // tick finished, these rows will be re-exported with a new payment_id and
  // the bank will receive a second file for the same refund. Most ACH
  // processors deduplicate on payment_id — confirm this behaviour with your
  // bank before relying on this recovery mechanism.
  const staleThresholdMs = env.paymentCron.intervalMs * 2;

  const { rows } = await pool.query<{ id: string }>(
    `UPDATE refunds
     SET status = 'pending',
         payment_id = NULL,
         updated_at = NOW()
     WHERE status = 'exported'
       AND updated_at < NOW() - ($1 || ' milliseconds')::interval
     RETURNING id`,
    [staleThresholdMs],
  );

  if (rows.length > 0) {
    console.warn(
      `[cron] Crash recovery: reverted ${rows.length} stuck exported refund(s) to pending: ` +
        rows.map((r) => r.id).join(", "),
    );
  }
}
