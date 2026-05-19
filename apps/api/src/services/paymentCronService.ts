import { pool } from "../db.js";
import { uploadSftpFile } from "../sftp.js";

type PendingRefundRow = {
  id: string;
  amount_cents: number;
  currency: string;
};

export async function runPaymentCronOnce() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the rows we are about to send so a concurrent tick can't pick
    // them up too; skip any already locked by another tick.
    const pending = await client.query<PendingRefundRow>(
      `SELECT id, amount_cents, currency
       FROM refunds
       WHERE status = 'pending'
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED`,
    );

    if (pending.rowCount === 0) {
      await client.query("ROLLBACK");
      console.log("Payment cron: no pending refunds.");
      return;
    }

    const file = buildPaymentCsv(pending.rows);

    // Upload before committing: if the SFTP write fails the transaction
    // rolls back and the refunds stay 'pending' for the next tick.
    await uploadSftpFile(file.filename, file.contents);

    await client.query(
      `UPDATE refunds
       SET status = 'sent_to_bank', updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [pending.rows.map((row) => row.id)],
    );

    await client.query("COMMIT");

    console.log(
      `Payment cron: sent ${pending.rowCount} refund(s) to bank as ${file.filename}.`,
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function buildPaymentCsv(rows: PendingRefundRow[]) {
  const headers = ["refund_id", "amount_cents", "currency"];
  const lines = [
    headers.join(","),
    ...rows.map((row) => [row.id, String(row.amount_cents), row.currency].join(",")),
  ];

  return {
    filename: `payments-${new Date().toISOString().replace(/[-:.]/g, "")}.csv`,
    contents: lines.join("\n") + "\n",
  };
}
