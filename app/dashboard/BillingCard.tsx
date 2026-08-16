"use client";

import { useState } from "react";

function daysUntil(dateString: string) {
  const ms = new Date(dateString).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function BillingCard({
  subscriptionStatus,
  trialEndsAt,
}: {
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redirectTo(path: string) {
    setLoading(true);
    setError(null);
    const res = await fetch(path, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(body.error || "Something went wrong. Please try again.");
      return;
    }
    window.location.href = body.url;
  }

  const isActive = subscriptionStatus === "active";
  const needsAttention =
    subscriptionStatus === "past_due" || subscriptionStatus === "canceled";

  return (
    <div className="border rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
      <div>
        {isActive && <p className="text-sm font-medium">Subscribed — $7/mo</p>}
        {subscriptionStatus === "trialing" && trialEndsAt && (
          <p className="text-sm font-medium">
            Trial ends in {daysUntil(trialEndsAt)} day{daysUntil(trialEndsAt) === 1 ? "" : "s"} — $7/mo after
          </p>
        )}
        {needsAttention && (
          <p className="text-sm font-medium text-amber-700">
            {subscriptionStatus === "past_due"
              ? "Payment issue — please update your billing."
              : "Subscription canceled."}
          </p>
        )}
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
      </div>
      <button
        onClick={() => redirectTo(isActive ? "/api/stripe/portal" : "/api/stripe/checkout")}
        disabled={loading}
        className="text-sm border rounded px-3 py-2 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 shrink-0"
      >
        {loading ? "Loading..." : isActive ? "Manage subscription" : "Subscribe"}
      </button>
    </div>
  );
}
