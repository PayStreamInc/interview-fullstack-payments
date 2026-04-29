import type { ClaimRefundRequest, Refund } from "@interview-payments/shared";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3000";

export async function fetchRefunds(): Promise<Refund[]> {
  const response = await fetch(`${apiUrl}/refunds`);
  if (!response.ok) throw new Error("Could not load refunds");
  return response.json() as Promise<Refund[]>;
}

export async function claimRefund(
  refundId: string,
  payload: ClaimRefundRequest,
  idempotencyKey: string,
): Promise<void> {
  const response = await fetch(`${apiUrl}/refunds/${refundId}/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? "Claim failed");
  }
}
