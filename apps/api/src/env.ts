import "dotenv/config";

export const env = {
  port: Number(process.env.API_PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://payments:payments@localhost:5432/payments",
  paymentCron: {
    intervalMs: Number(process.env.PAYMENT_CRON_INTERVAL_MS ?? 5000),
  },
  sftp: {
    host: process.env.SFTP_HOST ?? "localhost",
    port: Number(process.env.SFTP_PORT ?? 2222),
    username: process.env.SFTP_USERNAME ?? "payments",
    password: process.env.SFTP_PASSWORD ?? "payments",
    remoteDir: process.env.SFTP_REMOTE_DIR ?? "upload",
  },
};
