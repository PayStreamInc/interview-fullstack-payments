import { pool } from "../db.js";
import { createPaymentCsvFile, type PaymentCsvRow } from "./paymentCsv.js";
import { uploadSftpFile } from "../sftp.js";

export async function runPaymentCronOnce() {
  console.log("Payment cron tick.");

  try {
    const result = await pool.query<
      Record<string, string>
    >(
      `SELECT
         r.id AS refund_id,
         r.amount_cents,
         r.currency,
         c.routing_number,
         c.account_number,
         c.account_holder_name,
         c.account_type
       FROM refunds r
       JOIN refund_claims c ON c.refund_id = r.id
       WHERE r.status = 'pending' // and sftpStatus = null 
       ORDER BY r.created_at ASC`,
    );

    if (result.rowCount === 0) {
      console.log("No pending refunds to process.");
      return;
    }

    const rows: PaymentCsvRow[] = result.rows.map((row: any) => ({
      paymentId: String(row.refund_id),
      refundId: String(row.refund_id),
      amountCents: Number(row.amount_cents),
      currency: String(row.currency),
      routingNumber: String(row.routing_number ?? ""),
      accountNumber: String(row.account_number ?? ""),
      accountHolderName: String(row.account_holder_name ?? ""),
      accountType: (row.account_type === "savings" ? "savings" : "checking"),
    }));

    const file = createPaymentCsvFile(rows);

    const remotePath = await uploadSftpFile(file.filename, file.contents);
    // update all current page funds status via "sentToSFTP"

    console.log("Uploaded payment CSV to", remotePath, "rows=", file.rowCount);
  } catch (error) {
    console.error("Payment cron failed:", error);
    throw error;
  }
}
