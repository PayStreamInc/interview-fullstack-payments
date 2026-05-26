import { pool } from "../db.js";
import { uploadSftpFile } from "../sftp.js";
import { createPaymentCsv, type PaymentCsvRow } from "./paymentCsv.js";

type PendingRefundRow = {
  id: string;
  amount_cents: number;
  currency: string;
  payment_id: string | null;
  routing_number: string;
  account_number: string;
  account_holder_name: string;
  account_type: "checking" | "savings";
};

export async function runPaymentCronOnce() {
  const result = await pool.query<PendingRefundRow>(
    `SELECT id, amount_cents, currency, payment_id,
            routing_number, account_number, account_holder_name, account_type
     FROM refunds
     WHERE status = 'pending'
     ORDER BY updated_at ASC`,
  );

  if (result.rows.length === 0) {
    console.log("Payment cron tick: no pending refunds");
    return;
  }

  const rows: PaymentCsvRow[] = result.rows.map(toPaymentCsvRow);

  const contents = createPaymentCsv(rows);
  const filename = `${Math.floor(Date.now() / 1000)}.csv`;
  const remotePath = await uploadSftpFile(filename, contents);

  console.log(`Payment cron uploaded ${rows.length} payment(s) to ${remotePath}`);
}

function toPaymentCsvRow(refund: PendingRefundRow): PaymentCsvRow {
  if (!refund.payment_id) {
    throw new Error(`Refund ${refund.id} is pending without payment_id`);
  }

  return {
    paymentId: refund.payment_id,
    refundId: refund.id,
    amountCents: refund.amount_cents,
    currency: refund.currency,
    routingNumber: refund.routing_number,
    accountNumber: refund.account_number,
    accountHolderName: refund.account_holder_name,
    accountType: refund.account_type,
  };
}
