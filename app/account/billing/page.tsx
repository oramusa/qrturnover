import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/app/components/AppNav";
import LocalTime from "@/app/properties/[id]/LocalTime";
import PaymentMethodSection from "./PaymentMethodSection";
import CancelSubscriptionButton from "./CancelSubscriptionButton";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountCents / 100);
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Incomplete (expired)",
  paused: "Paused",
};

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: host } = await supabase
    .from("hosts")
    .select("stripe_customer_id, subscription_status, trial_ends_at")
    .eq("id", user!.id)
    .single();

  let subscription: Stripe.Subscription | null = null;
  let paymentMethod: Stripe.PaymentMethod | null = null;
  let invoices: Stripe.Invoice[] = [];

  // A stored customer id can go stale if the Stripe account backing
  // STRIPE_SECRET_KEY changes (e.g. switching from a sandbox/other account to
  // a different live account) — Stripe then rejects it as "no such customer".
  // Treat that as "no billing data yet" instead of crashing the page.
  if (host?.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: host.stripe_customer_id,
        status: "all",
        limit: 1,
        expand: ["data.default_payment_method", "data.items.data.price"],
      });
      subscription = subs.data[0] ?? null;

      if (subscription?.default_payment_method) {
        paymentMethod = subscription.default_payment_method as Stripe.PaymentMethod;
      } else {
        const pms = await stripe.paymentMethods.list({
          customer: host.stripe_customer_id,
          type: "card",
        });
        paymentMethod = pms.data[0] ?? null;
      }

      const invoiceList = await stripe.invoices.list({
        customer: host.stripe_customer_id,
        limit: 12,
      });
      invoices = invoiceList.data;
    } catch (err) {
      console.error("Failed to load Stripe billing data for", host.stripe_customer_id, err);
    }
  }

  const item = subscription?.items.data[0];
  const price = item?.price;
  const card = paymentMethod?.card;

  return (
    <>
      <AppNav current="/account" />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">Billing &amp; Subscription</h1>

        <div className="border rounded-lg p-4 mb-6">
          <p className="text-xs text-muted">Plan</p>
          {price ? (
            <p className="text-sm mt-1">
              {formatMoney(price.unit_amount ?? 0, price.currency)}
              {price.recurring ? ` / ${price.recurring.interval}` : ""}
            </p>
          ) : (
            <p className="text-sm mt-1 text-muted">
              {host?.subscription_status === "trialing" ? "Free trial" : "No active plan"}
            </p>
          )}

          <p className="text-xs text-muted mt-3">Status</p>
          <p className="text-sm mt-1">
            {subscription
              ? STATUS_LABEL[subscription.status] ?? subscription.status
              : STATUS_LABEL[host?.subscription_status ?? ""] ?? "No subscription yet"}
            {subscription?.cancel_at_period_end && " — cancels at period end"}
          </p>

          {item && (
            <>
              <p className="text-xs text-muted mt-3">
                {subscription?.cancel_at_period_end ? "Access ends" : "Renews"}
              </p>
              <p className="text-sm mt-1">
                <LocalTime
                  iso={new Date(item.current_period_end * 1000).toISOString()}
                  options={{ year: "numeric", month: "long", day: "numeric" }}
                />
              </p>
            </>
          )}
        </div>

        {subscription && (
          <PaymentMethodSection
            brand={card?.brand ?? null}
            last4={card?.last4 ?? null}
            expMonth={card?.exp_month ?? null}
            expYear={card?.exp_year ?? null}
          />
        )}

        {subscription && subscription.status !== "canceled" && (
          <div className="mb-6">
            <CancelSubscriptionButton
              subscriptionId={subscription.id}
              cancelAtPeriodEnd={subscription.cancel_at_period_end}
            />
          </div>
        )}

        <h2 className="text-sm font-medium mb-2">Invoice history</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">No invoices yet.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="border rounded-lg px-4 py-3 flex items-center justify-between text-sm"
              >
                <div>
                  <p>
                    <LocalTime
                      iso={new Date(inv.created * 1000).toISOString()}
                      options={{ year: "numeric", month: "short", day: "numeric" }}
                    />
                  </p>
                  <p className="text-muted text-xs mt-0.5 capitalize">{inv.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span>{formatMoney(inv.amount_paid, inv.currency)}</span>
                  {inv.invoice_pdf && (
                    <a
                      href={inv.invoice_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted underline text-xs"
                    >
                      PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
