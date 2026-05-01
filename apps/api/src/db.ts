import { Pool } from "pg";
import { env } from "./env.js";

export const pool = new Pool({ connectionString: env.databaseUrl });

export type RefundRow = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  account_holder_name: string | null;
  routing_number: string | null;
  account_number: string | null;
  account_type: string | null;
};

export type PendingRefundRow = {
  id: string;
  amount_cents: number;
  currency: string;
  account_holder_name: string;
  routing_number: string;
  account_number: string;
  account_type: "checking" | "savings";
};

export function mapRefund(row: RefundRow) {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    accountHolderName: row.account_holder_name,
    routingNumber: row.routing_number,
    accountNumber: row.account_number,
    accountType: row.account_type,
  };
}
