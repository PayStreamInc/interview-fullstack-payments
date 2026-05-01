import { claimRefundRequestSchema } from "@interview-payments/shared";
import cors from "cors";
import express from "express";
import { mapRefund, pool, type RefundRow } from "./db.js";
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
      `SELECT id, amount_cents, currency, status, account_holder_name, routing_number, account_number, account_type
       FROM refunds
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
      `SELECT id, amount_cents, currency, status, account_holder_name, routing_number, account_number, account_type FROM refunds WHERE id = $1`,
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
    res.status(400).json({ error: "Invalid claim request", details: parsed.error.flatten() });
    return;
  }

  const idempotencyKey = req.headers["idempotency-key"];
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    res.status(400).json({ error: "Missing Idempotency-Key header" });
    return;
  }

  const client = await pool.connect();
  try {
    const existing = await client.query<{ response_status: number; response_body: unknown }>(
      `SELECT response_status, response_body FROM idempotency_keys WHERE key = $1`,
      [idempotencyKey],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      const stored = existing.rows[0];
      res.status(stored.response_status).json(stored.response_body);
      return;
    }

    await client.query("BEGIN");

    const { accountHolderName, routingNumber, accountNumber, accountType } = parsed.data;
    const result = await client.query<RefundRow>(
      `UPDATE refunds
       SET status = 'pending',
           account_holder_name = $2,
           routing_number = $3,
           account_number = $4,
           account_type = $5,
           updated_at = NOW()
       WHERE id = $1 AND status = 'unclaimed'
       RETURNING id, amount_cents, currency, status, account_holder_name, routing_number, account_number, account_type`,
      [req.params.id, accountHolderName, routingNumber, accountNumber, accountType],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Refund not found or already claimed" });
      return;
    }

    const responseBody = mapRefund(result.rows[0]);

    try {
      await client.query(
        `INSERT INTO idempotency_keys (key, refund_id, response_status, response_body)
         VALUES ($1, $2, 200, $3::jsonb)`,
        [idempotencyKey, req.params.id, JSON.stringify(responseBody)],
      );
    } catch (insertErr: unknown) {
      if (
        typeof insertErr === "object" &&
        insertErr !== null &&
        (insertErr as { code?: string }).code === "23505"
      ) {
        await client.query("ROLLBACK");
        const raceRow = await client.query<{ response_status: number; response_body: unknown }>(
          `SELECT response_status, response_body FROM idempotency_keys WHERE key = $1`,
          [idempotencyKey],
        );
        const stored = raceRow.rows[0];
        res.status(stored.response_status).json(stored.response_body);
        return;
      }
      throw insertErr;
    }

    await client.query("COMMIT");
    res.json(responseBody);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
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
