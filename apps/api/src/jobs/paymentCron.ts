import { env } from "../env.js";
import { runPaymentCronOnce } from "../services/paymentCronService.js";

const runOnce = process.argv.includes("--once");
let isRunning = false;

async function runTick() {
  if (isRunning) {
    console.warn("Payment cron tick skipped because previous tick is still running");
    return;
  }

  isRunning = true;

  try {
    await runPaymentCronOnce();
  } finally {
    isRunning = false;
  }
}

async function main() {
  if (!Number.isFinite(env.paymentCron.intervalMs) || env.paymentCron.intervalMs <= 0) {
    throw new Error("PAYMENT_CRON_INTERVAL_MS must be a positive number");
  }

  console.log(
    runOnce
      ? "Payment cron running once"
      : `Payment cron running every ${env.paymentCron.intervalMs}ms`,
  );

  if (runOnce) {
    await runTick();
    return;
  }

  await runTick().catch((error) => console.error("Payment cron failed", error));

  setInterval(() => {
    runTick().catch((error) => console.error("Payment cron failed", error));
  }, env.paymentCron.intervalMs);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
