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
    <div className="border border-gray-800 rounded-xl p-5 mb-6 bg-gray-950">
      <div>
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">QRTurnover plan</p>
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
      <div className="mt-5 pt-4 border-t border-gray-800">
      {managingExisting ? (
        <Link
          href="/account/billing"
          className="inline-block text-sm border border-gray-700 rounded-lg px-3 py-2 hover:border-gray-500 shrink-0"
        >
          {isPastDue ? "Update payment method" : "Manage subscription"}
        </Link>
      ) : (
        <Link
          href="/account/subscribe"
          className="inline-block text-sm bg-green-600 text-white rounded-lg px-4 py-2.5 hover:bg-green-500 shrink-0"
        >
          Subscribe
        </Link>
      )}
      </div>
    </div>
  );
}
