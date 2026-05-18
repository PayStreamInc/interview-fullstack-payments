import { z } from "zod";

export const refundStatusSchema = z.enum(["unclaimed", "pending", "failed", "completed"]);

export type RefundStatus = z.infer<typeof refundStatusSchema>;

export const refundSchema = z.object({
  id: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  status: refundStatusSchema,
});

export type Refund = z.infer<typeof refundSchema>;

export const claimRefundRequestSchema = z.object({
  accountHolderName: z.string().trim().min(2).max(120),
  routingNumber: z.string().regex(/^\d{9}$/, "Routing number must be 9 digits"),
  accountNumber: z.string().regex(/^\d{4,17}$/, "Account number must be 4-17 digits"),
  accountType: z.enum(["checking", "savings"]),
});

export type ClaimRefundRequest = z.infer<typeof claimRefundRequestSchema>;

export type ApiError = {
  error: string;
  details?: unknown;
};
