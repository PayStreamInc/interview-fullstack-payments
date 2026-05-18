import type { Refund, RefundStatus } from "@interview-payments/shared";
import { Pool } from "pg";
import { env } from "./env.js";

export const pool = new Pool({ connectionString: env.databaseUrl });

export type RefundRow = {
  id: string;
  amount_cents: number;
  currency: string;
  status: RefundStatus;
};

export function mapRefund(row: RefundRow): Refund {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
  };
}
