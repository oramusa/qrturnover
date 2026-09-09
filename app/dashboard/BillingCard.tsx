import Link from "next/link";

export default function BillingCard({
  subscriptionStatus,
  trialDaysLeft,
  priceLabel,
}: {
  subscriptionStatus: string | null;
  trialDaysLeft: number | null;
  priceLabel: string;
}) {
  const isActive = subscriptionStatus === "active";
  const isPastDue = subscriptionStatus === "past_due";
  const needsAttention = isPastDue || subscriptionStatus === "canceled";
  const managingExisting = isActive || isPastDue;

  return (
    <div className="border rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
      <div>
        {isActive && <p className="text-sm font-medium">Subscribed — {priceLabel}</p>}
        {subscriptionStatus === "trialing" && trialDaysLeft !== null && (
          <p className="text-sm font-medium">
            {trialDaysLeft > 0
              ? `Trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} — ${priceLabel} after`
              : `Your free trial has ended — subscribe for ${priceLabel} to continue`}
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
            <p className="text-sm font-medium">Subscribe to QRTurnover — {priceLabel}</p>
          )}
      </div>
      {managingExisting ? (
        <Link
          href="/account/billing"
          className="text-sm border rounded px-3 py-2 hover:bg-gray-50 hover:text-gray-900 shrink-0"
        >
          {isPastDue ? "Update payment method" : "Manage subscription"}
        </Link>
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
