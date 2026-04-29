import type { ClaimRefundRequest, Refund } from "@interview-payments/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { claimRefund, fetchRefunds } from "../services/refundService";

export function useRefunds() {
  const queryClient = useQueryClient();
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data: refunds,
    isLoading,
    error: loadError,
  } = useQuery<Refund[], Error>({
    queryKey: ["refunds"],
    queryFn: fetchRefunds,
  });

  useEffect(() => {
    if (!selectedRefund && refunds && refunds.length > 0) {
      setSelectedRefund(refunds[0]);
    }
  }, [refunds, selectedRefund]);

  const {
    mutate: submitClaim,
    isPending: isSubmitting,
    error: claimError,
    reset: resetClaimError,
  } = useMutation<void, Error, { payload: ClaimRefundRequest; idempotencyKey: string }>({
    mutationFn: ({ payload, idempotencyKey }) => {
      if (!selectedRefund) throw new Error("No refund selected");
      return claimRefund(selectedRefund.id, payload, idempotencyKey);
    },
    onSuccess() {
      setSuccessMessage("Refund claim submitted.");
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
    },
  });

  function selectRefund(refund: Refund) {
    setSelectedRefund(refund);
    setSuccessMessage(null);
    resetClaimError();
  }

  function handleClaimSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRefund) return;

    setSuccessMessage(null);
    resetClaimError();

    const formData = new FormData(event.currentTarget);
    const payload: ClaimRefundRequest = {
      accountHolderName: String(formData.get("accountHolderName") ?? ""),
      routingNumber: String(formData.get("routingNumber") ?? ""),
      accountNumber: String(formData.get("accountNumber") ?? ""),
      accountType: String(
        formData.get("accountType") ?? "checking",
      ) as ClaimRefundRequest["accountType"],
    };

    submitClaim({ payload, idempotencyKey: crypto.randomUUID() });
  }

  return {
    refunds: refunds ?? [],
    selectedRefund,
    isLoading,
    isSubmitting,
    successMessage,
    error: claimError?.message ?? loadError?.message ?? null,
    selectRefund,
    handleClaimSubmit,
  };
}
