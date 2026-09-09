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

  return (
    <>
      <AppNav current="/account" />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">Account</h1>

        {params.checkout === "success" && (
          <p className="text-sm bg-green-50 text-green-800 rounded p-3 mb-6">
            Payment successful — thanks for subscribing! It may take a moment for your status
            below to update.
          </p>
        )}

        <div className="border rounded-lg p-4 mb-6">
          <p className="text-xs text-muted">Email</p>
          <p className="text-sm mt-1">{user?.email}</p>
        </div>

        <h2 className="text-sm font-medium mb-2">Mailing address</h2>
        <MailingAddressForm
          initialAddress={{
            address_line: host?.address_line ?? null,
            city: host?.city ?? null,
            state: host?.state ?? null,
            zip_code: host?.zip_code ?? null,
            country: host?.country ?? null,
          }}
        />

        <h2 className="text-sm font-medium mb-2">Billing</h2>
        <BillingCard
          subscriptionStatus={host?.subscription_status ?? null}
          trialDaysLeft={trialDaysLeft}
          priceLabel={priceLabel}
        />
      </div>
    </>
  );
}
