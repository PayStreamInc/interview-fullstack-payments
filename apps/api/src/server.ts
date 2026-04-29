import { claimRefundRequestSchema, RefundStatus } from "@interview-payments/shared";
import cors from "cors";
import express from "express";
import { pool, mapRefund, type RefundRow } from "./db.js";
import { encrypt } from "./encryption.js";
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

app.get("/refunds/:id", async (req, res, next) => {
  try {
    const result = await pool.query<RefundRow>(
      `SELECT id, amount_cents, currency, status FROM refunds WHERE id = $1`,
      [req.params.id],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Refund not found" });
      return;
    }

    res.json(mapRefund(result.rows[0]));
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

  const idempotencyKey = req.headers["idempotency-key"];

  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    res.status(400).json({ error: "Idempotency-Key header is required" });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Idempotency: return early if this key was already processed
    const existingKey = await client.query(
      `SELECT key FROM idempotency_keys WHERE key = $1`,
      [idempotencyKey],
    );

    if ((existingKey.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      res.status(200).json({ message: "Already processed" });
      return;
    }

    // Check refund exists
    const refundResult = await client.query<RefundRow>(
      `SELECT id, amount_cents, currency, status FROM refunds WHERE id = $1 FOR UPDATE`,
      [req.params.id],
    );

    if ((refundResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Refund not found" });
      return;
    }

    const refund = refundResult.rows[0];

    // Check refund is still unclaimed
    if (refund.status !== RefundStatus.Unclaimed) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: `Refund is already ${refund.status}` });
      return;
    }

    // Update status to pending
    await client.query(
      `UPDATE refunds SET status = $1, updated_at = now() WHERE id = $2`,
      [RefundStatus.Pending, req.params.id],
    );

    // Persist claim details — account number encrypted at rest
    const accountNumberEncrypted = encrypt(parsed.data.accountNumber, env.encryptionKey);

    await client.query(
      `INSERT INTO refund_claims
         (refund_id, account_holder_name, routing_number, account_number_encrypted, account_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.params.id,
        parsed.data.accountHolderName,
        parsed.data.routingNumber,
        accountNumberEncrypted,
        parsed.data.accountType,
      ],
    );

    // Store idempotency key
    await client.query(
      `INSERT INTO idempotency_keys (key, refund_id) VALUES ($1, $2)`,
      [idempotencyKey, req.params.id],
    );

    await client.query("COMMIT");

    res.status(200).json({ message: "Refund claim submitted" });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
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
