export type PaymentCsvRow = {
  paymentId: string;
  refundId: string;
  amountCents: number;
  currency: string;
  routingNumber: string;
  accountNumber: string;
  accountHolderName: string;
  accountType: "checking" | "savings";
};

export type PaymentCsvFile = {
  filename: string;
  contents: string;
  rowCount: number;
};

export type PaymentResponseCsvRow = {
  paymentId: string;
  refundId: string;
  status: "accepted" | "rejected";
  reason: string;
  processedAt: string;
};

const paymentCsvHeaders = [
  "payment_id",
  "refund_id",
  "amount_cents",
  "currency",
  "routing_number",
  "account_number",
  "account_holder_name",
  "account_type",
] as const;

type PaymentCsvHeader = (typeof paymentCsvHeaders)[number];

const paymentResponseCsvHeaders = [
  "payment_id",
  "refund_id",
  "status",
  "reason",
  "processed_at",
] as const;

export function createPaymentCsv(rows: PaymentCsvRow[]) {
  const records = rows.map(toPaymentCsvRecord);

  return (
    [
      paymentCsvHeaders.join(","),
      ...records.map((record) =>
        paymentCsvHeaders.map((header) => escapeCsv(record[header])).join(","),
      ),
    ].join("\n") + "\n"
  );
}

export function createPaymentCsvFile(
  rows: PaymentCsvRow[],
  createdAt = new Date(),
): PaymentCsvFile {
  return {
    filename: `payments-${formatTimestamp(createdAt)}.csv`,
    contents: createPaymentCsv(rows),
    rowCount: rows.length,
  };
}

export function parsePaymentResponseCsv(contents: string | Buffer): PaymentResponseCsvRow[] {
  const records = parseCsvRecords(String(contents));

  return records.map((record, index) => toPaymentResponseCsvRow(record, index + 2));
}

function toPaymentCsvRecord(row: PaymentCsvRow): Record<PaymentCsvHeader, string> {
  validatePaymentCsvRow(row);

  return {
    payment_id: row.paymentId,
    refund_id: row.refundId,
    amount_cents: String(row.amountCents),
    currency: row.currency,
    routing_number: row.routingNumber,
    account_number: row.accountNumber,
    account_holder_name: row.accountHolderName,
    account_type: row.accountType,
  };
}

function validatePaymentCsvRow(row: PaymentCsvRow) {
  if (!row.paymentId) throw new Error("paymentId is required");
  if (!row.refundId) throw new Error("refundId is required");
  if (!Number.isInteger(row.amountCents) || row.amountCents <= 0) {
    throw new Error("amountCents must be a positive integer");
  }
  if (!/^[A-Z]{3}$/.test(row.currency)) throw new Error("currency must be a 3-letter code");
  if (!/^\d{9}$/.test(row.routingNumber)) throw new Error("routingNumber must be 9 digits");
  if (!/^\d{4,17}$/.test(row.accountNumber)) {
    throw new Error("accountNumber must be 4-17 digits");
  }
  if (!row.accountHolderName.trim()) throw new Error("accountHolderName is required");
  if (row.accountType !== "checking" && row.accountType !== "savings") {
    throw new Error("accountType must be checking or savings");
  }
}

function escapeCsv(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function formatTimestamp(date: Date) {
  return date.toISOString().replace(/[-:.]/g, "");
}

function parseCsvRecords(contents: string) {
  const lines = contents.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]);
  validateResponseHeaders(headers);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function toPaymentResponseCsvRow(
  record: Record<string, string>,
  lineNumber: number,
): PaymentResponseCsvRow {
  const status = record.status;

  if (status !== "accepted" && status !== "rejected") {
    throw new Error(`Line ${lineNumber}: status must be accepted or rejected`);
  }

  if (!record.payment_id) throw new Error(`Line ${lineNumber}: payment_id is required`);
  if (!record.refund_id) throw new Error(`Line ${lineNumber}: refund_id is required`);
  if (!record.processed_at) throw new Error(`Line ${lineNumber}: processed_at is required`);

  return {
    paymentId: record.payment_id,
    refundId: record.refund_id,
    status,
    reason: record.reason ?? "",
    processedAt: record.processed_at,
  };
}

function validateResponseHeaders(headers: string[]) {
  const expectedHeaders = paymentResponseCsvHeaders.join(",");
  const actualHeaders = headers.join(",");

  if (actualHeaders !== expectedHeaders) {
    throw new Error(`Invalid payment response CSV headers: expected ${expectedHeaders}`);
  }
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
