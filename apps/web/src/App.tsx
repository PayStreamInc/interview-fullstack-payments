import type { ClaimRefundRequest, Refund } from "@interview-payments/shared";
import { useEffect, useState } from "react";
import { Alert } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3000";

export function App() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/refunds`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load refunds");
        return response.json() as Promise<Refund[]>;
      })
      .then((availableRefunds) => {
        setRefunds(availableRefunds);
        setSelectedRefund(availableRefunds[0] ?? null);
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, []);

  function selectRefund(refund: Refund) {
    setSelectedRefund(refund);
    setMessage(null);
    setError(null);
  }

  async function claimRefund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRefund) return;

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload: ClaimRefundRequest = {
      accountHolderName: String(formData.get("accountHolderName") ?? ""),
      routingNumber: String(formData.get("routingNumber") ?? ""),
      accountNumber: String(formData.get("accountNumber") ?? ""),
      accountType: String(
        formData.get("accountType") ?? "checking",
      ) as ClaimRefundRequest["accountType"],
    };

    try {
      const response = await fetch(`${apiUrl}/refunds/${selectedRefund.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Claim failed");
      }

      setMessage("Refund claim submitted.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Claim failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Available Refunds</CardTitle>
          <p className="text-sm text-slate-600">
            Select an unclaimed refund, then enter ACH details.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            {isLoading ? <p className="text-sm text-slate-600">Loading refunds...</p> : null}
            {!isLoading && refunds.length === 0 ? (
              <Alert>No unclaimed refunds available.</Alert>
            ) : null}
            <div className="space-y-2">
              {refunds.map((refund) => (
                <button
                  className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                    selectedRefund?.id === refund.id
                      ? "border-primary bg-muted"
                      : "border-border bg-white hover:bg-muted"
                  }`}
                  key={refund.id}
                  onClick={() => selectRefund(refund)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      ${(refund.amountCents / 100).toFixed(2)} {refund.currency}
                    </span>
                    <span className="text-xs text-slate-500">{refund.status}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{refund.id}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <div>
              <h2 className="text-lg font-semibold">Claim ACH Refund</h2>
              <p className="text-sm text-slate-600">
                Selected refund:{" "}
                {selectedRefund
                  ? `$${(selectedRefund.amountCents / 100).toFixed(2)} ${selectedRefund.currency}`
                  : "none"}
              </p>
            </div>

            <form className="space-y-4" onSubmit={claimRefund}>
              <div className="space-y-2">
                <Label htmlFor="accountHolderName">Account holder name</Label>
                <Input id="accountHolderName" name="accountHolderName" autoComplete="name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="routingNumber">Routing number</Label>
                <Input id="routingNumber" name="routingNumber" inputMode="numeric" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account number</Label>
                <Input id="accountNumber" name="accountNumber" inputMode="numeric" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountType">Account type</Label>
                <select
                  id="accountType"
                  name="accountType"
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </div>

              {message ? <Alert>{message}</Alert> : null}
              {error ? <Alert variant="destructive">{error}</Alert> : null}

              <Button
                className="w-full"
                disabled={isSubmitting || selectedRefund?.status !== "unclaimed"}
              >
                {isSubmitting ? "Submitting..." : "Claim refund"}
              </Button>
            </form>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
