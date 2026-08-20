"use client";

import { useState } from "react";
import Link from "next/link";

export default function BillingCard({
  subscriptionStatus,
  trialDaysLeft,
}: {
  subscriptionStatus: string | null;
  trialDaysLeft: number | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goToPortal() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      setLoading(false);
      setError(body.error || "Something went wrong. Please try again.");
      return;
    }
    window.location.href = body.url;
  }

  const isActive = subscriptionStatus === "active";
  const isPastDue = subscriptionStatus === "past_due";
  const needsAttention = isPastDue || subscriptionStatus === "canceled";
  const managingExisting = isActive || isPastDue;

  return (
    <div className="border rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
      <div>
        {isActive && <p className="text-sm font-medium">Subscribed — $7/mo</p>}
        {subscriptionStatus === "trialing" && trialDaysLeft !== null && (
          <p className="text-sm font-medium">
            Trial ends in {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} — $7/mo after
          </p>
        )}
        {needsAttention && (
          <p className="text-sm font-medium text-amber-700">
            {isPastDue
              ? "Payment issue — please update your billing."
              : "Subscription canceled."}
          </p>
        )}
        {!isActive &&
          !(subscriptionStatus === "trialing" && trialDaysLeft !== null) &&
          !needsAttention && (
            <p className="text-sm font-medium">Subscribe to QRTurnover — $7/mo</p>
          )}
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
      </div>
      {managingExisting ? (
        <button
          onClick={goToPortal}
          disabled={loading}
          className="text-sm border rounded px-3 py-2 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 shrink-0"
        >
          {loading ? "Loading..." : isPastDue ? "Update payment method" : "Manage subscription"}
        </button>
      ) : (
        <Link
          href="/account/subscribe"
          className="text-sm border rounded px-3 py-2 hover:bg-gray-50 hover:text-gray-900 shrink-0"
        >
          Subscribe
        </Link>
      )}
    </div>
  );
}
