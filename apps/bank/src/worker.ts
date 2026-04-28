import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const inputDir = process.env.BANK_INPUT_DIR ?? "/sftp/outbound";
const outputDir = process.env.BANK_OUTPUT_DIR ?? "/sftp/inbound";
const archiveDir = process.env.BANK_ARCHIVE_DIR ?? "/sftp/archive";
const pollMs = Number(process.env.BANK_POLL_MS ?? 3000);

type PaymentRow = Record<string, string>;

async function main() {
  await Promise.all([
    mkdir(inputDir, { recursive: true }),
    mkdir(outputDir, { recursive: true }),
    mkdir(archiveDir, { recursive: true }),
  ]);
  console.log(`Bank simulator watching ${inputDir}`);

  await processPendingFiles();
  setInterval(() => {
    processPendingFiles().catch((error) => console.error("Bank simulator failed", error));
  }, pollMs);
}

async function processPendingFiles() {
  const files = (await readdir(inputDir)).filter((file) => file.endsWith(".csv"));

  for (const file of files) {
    await processFile(file).catch((error) => console.error(`Failed to process ${file}`, error));
  }
}

async function processFile(file: string) {
  const sourcePath = path.join(inputDir, file);
  const processingPath = path.join(inputDir, `${file}.processing`);

  await rename(sourcePath, processingPath);

  const contents = await readFile(processingPath, "utf8");
  const rows = parseCsv(contents);
  const responseRows = rows.map(toResponseRow);
  const responseName = `${path.basename(file, ".csv")}.response.csv`;

  await writeFile(path.join(outputDir, responseName), toCsv(responseRows));
  await rename(processingPath, path.join(archiveDir, file));
  console.log(`Processed ${file} -> ${responseName}`);
}

function toResponseRow(row: PaymentRow) {
  const errors = validatePayment(row);

  return {
    payment_id: row.payment_id ?? "",
    refund_id: row.refund_id ?? "",
    status: errors.length === 0 ? "accepted" : "rejected",
    reason: errors.join("; "),
    processed_at: new Date().toISOString(),
  };
}

function validatePayment(row: PaymentRow) {
  const errors: string[] = [];

  if (!row.payment_id) errors.push("missing payment_id");
  if (!row.refund_id) errors.push("missing refund_id");
  if (!/^\d+$/.test(row.amount_cents ?? "") || Number(row.amount_cents) <= 0)
    errors.push("invalid amount_cents");
  if (row.currency !== "USD") errors.push("unsupported currency");
  if (!/^\d{9}$/.test(row.routing_number ?? "")) errors.push("invalid routing_number");
  if (!/^\d{4,17}$/.test(row.account_number ?? "")) errors.push("invalid account_number");
  if (!row.account_holder_name) errors.push("missing account_holder_name");
  if (row.account_type !== "checking" && row.account_type !== "savings")
    errors.push("invalid account_type");

  return errors;
}

function parseCsv(contents: string) {
  const lines = contents.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  values.push(value);
  return values;
}

function toCsv(rows: Array<Record<string, string>>) {
  const headers = ["payment_id", "refund_id", "status", "reason", "processed_at"];
  return (
    [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escapeCsv(row[header] ?? "")).join(",")),
    ].join("\n") + "\n"
  );
}

function escapeCsv(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
