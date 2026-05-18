import { claimRefundRequestSchema } from "@interview-payments/shared";
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

app.post("/refunds/:id/claim", async (req, res) => {
  const parsed = claimRefundRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid claim request",
      details: parsed.error.flatten(),
    });
    return;
  }

  res.status(501).json({ error: "Claim flow is intentionally left as the interview task" });
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
