"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelSubscriptionButton({
  subscriptionId,
  cancelAtPeriodEnd,
}: {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    const confirmed = confirm(
      cancelAtPeriodEnd
        ? "Resume your subscription? It will continue renewing as normal."
        : "Cancel your subscription? You'll keep access until the end of your current billing period, then it won't renew."
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    const res = await fetch("/api/stripe/cancel-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId, resume: cancelAtPeriodEnd }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`text-sm border rounded px-3 py-2 disabled:opacity-50 ${
          cancelAtPeriodEnd
            ? "hover:bg-gray-50 hover:text-gray-900"
            : "text-red-600 border-red-200 hover:bg-red-50"
        }`}
      >
        {loading ? "Working..." : cancelAtPeriodEnd ? "Resume subscription" : "Cancel subscription"}
      </button>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
