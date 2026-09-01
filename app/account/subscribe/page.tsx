import Stripe from "stripe";
import AppNav from "@/app/components/AppNav";
import SubscribeForm from "./SubscribeForm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Hits the live Stripe price each request instead of baking a build-time
// snapshot into the static page.
export const dynamic = "force-dynamic";

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountCents / 100);
}

export default async function SubscribePage() {
  const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID!);

  return (
    <>
      <AppNav current="/account" />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-1">Subscribe</h1>
        <p className="text-sm text-muted mb-6">
          {formatMoney(price.unit_amount ?? 0, price.currency)}
          {price.recurring ? ` / ${price.recurring.interval}` : ""}
        </p>
        <SubscribeForm />
      </div>
    </>
  );
}
