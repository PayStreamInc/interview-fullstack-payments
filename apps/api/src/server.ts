import { randomUUID } from "node:crypto";
import { claimRefundRequestSchema, type RefundStatus } from "@interview-payments/shared";
import cors from "cors";
import express from "express";
import { pool, mapRefund, type RefundRow } from "./db.js";
import { env } from "./env.js";
import { listSftpDirectory } from "./sftp.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/refunds", async (_req, res, next) => {
  try {
    const result = await pool.query<RefundRow>(
      `SELECT id, amount_cents, currency, status
       FROM refunds
       WHERE status = 'unclaimed'
       ORDER BY created_at DESC`,
    );

    res.json(result.rows.map(mapRefund));
  } catch (error) {
    next(error);
  }
});

app.post("/refunds/:id/claim", async (req, res, next) => {
  const parsed = claimRefundRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid claim request",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const claim = parsed.data;
    const paymentId = `pay_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

    const updated = await pool.query<RefundRow>(
      `UPDATE refunds
       SET status = 'pending',
           updated_at = now(),
           payment_id = $2,
           account_holder_name = $3,
           routing_number = $4,
           account_number = $5,
           account_type = $6
       WHERE id = $1::uuid AND status = 'unclaimed'
       RETURNING id, amount_cents, currency, status`,
      [
        req.params.id,
        paymentId,
        claim.accountHolderName,
        claim.routingNumber,
        claim.accountNumber,
        claim.accountType,
      ],
    );

    if (updated.rowCount === 1 && updated.rows[0]) {
      res.status(200).json(mapRefund(updated.rows[0]));
      return;
    }

    const existing = await pool.query<{ status: RefundStatus }>(
      `SELECT status FROM refunds WHERE id = $1::uuid`,
      [req.params.id],
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ error: "Refund not found" });
      return;
    }

    res.status(409).json({ error: "Refund must be unclaimed to claim" });
  } catch (error) {
    next(error);
  }
});

app.post("/dev/sftp-test", async (_req, res, next) => {
  try {
    const files = await listSftpDirectory();
    res.json({ ok: true, files });
  } catch (error) {
    next(error);
  }
});

app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  },
);

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
