import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";
import AppNav from "@/app/components/AppNav";
import BillingCard from "@/app/dashboard/BillingCard";
import MailingAddressForm from "./MailingAddressForm";

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountCents / 100);
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: host, error: hostError } = await supabase
    .from("hosts")
    .select("subscription_status, trial_ends_at, address_line, city, state, zip_code, country")
    .eq("id", user!.id)
    .single();

  if (hostError) {
    console.error("Failed to load host billing info:", hostError);
  }

  let priceLabel = "$19.00/month";
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID) {
    try {
      const stripe = createStripeClient();
      const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
      priceLabel = `${formatMoney(price.unit_amount ?? 0, price.currency)}${
        price.recurring ? `/${price.recurring.interval}` : ""
      }`;
    } catch (error) {
      console.error("Failed to load Stripe price; using the configured display price", error);
    }
  }

  const now = new Date();
  const trialDaysLeft = host?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(host.trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const subscriptionLabel =
    host?.subscription_status === "active"
      ? "Active plan"
      : host?.subscription_status === "trialing" && trialDaysLeft !== null && trialDaysLeft > 0
        ? `${trialDaysLeft} trial day${trialDaysLeft === 1 ? "" : "s"} left`
        : "Action needed";

  return (
    <>
      <AppNav current="/account" />
      <div className="max-w-5xl mx-auto p-6 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-500 mb-2">
          Settings
        </p>
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="text-sm text-muted mt-2 mb-7">
          Manage your profile, delivery address, and QRTurnover subscription.
        </p>

        {params.checkout === "success" && (
          <p className="text-sm bg-green-950 text-green-200 border border-green-800 rounded-xl p-4 mb-6">
            Payment successful — thanks for subscribing! It may take a moment for your status
            below to update.
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="border border-gray-800 rounded-xl p-5 bg-gray-950 flex items-center gap-4">
            <span className="w-11 h-11 rounded-full bg-green-950 text-green-300 flex items-center justify-center font-semibold shrink-0">
              {user?.email?.charAt(0).toUpperCase() ?? "A"}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted">Signed in as</p>
              <p className="text-sm font-medium mt-1 break-words">{user?.email}</p>
            </div>
          </div>
          <div className="border border-gray-800 rounded-xl p-5 bg-gray-950">
            <p className="text-xs text-muted">Subscription status</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-2 h-2 rounded-full ${host?.subscription_status === "active" ? "bg-green-500" : "bg-amber-400"}`} />
              <p className="text-sm font-medium">{subscriptionLabel}</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6 items-start">
        <section>
        <h2 className="text-lg font-medium">Mailing address</h2>
        <p className="text-xs text-muted mt-1 mb-3">Used when printed QR sets are shipped to you.</p>
        <MailingAddressForm
          initialAddress={{
            address_line: host?.address_line ?? null,
            city: host?.city ?? null,
            state: host?.state ?? null,
            zip_code: host?.zip_code ?? null,
            country: host?.country ?? null,
          }}
        />
        </section>
        <section>
        <h2 className="text-lg font-medium">Billing</h2>
        <p className="text-xs text-muted mt-1 mb-3">Your plan and payment settings.</p>
        <BillingCard
          subscriptionStatus={host?.subscription_status ?? null}
          trialDaysLeft={trialDaysLeft}
          priceLabel={priceLabel}
        />
        </section>
        </div>
      </div>
    </>
  );
}
