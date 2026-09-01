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

const INCLUDED = [
  "Unlimited properties and zones",
  "QR-code cleaning verification for every turnover",
  "Cleaner checklists and photo proof",
  "Full turnover history and reporting",
];

export default async function SubscribePage() {
  const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID!);

  return (
    <>
      <AppNav current="/account" />
      <div className="max-w-md mx-auto p-6 mt-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold">Subscribe to QRTurnover</h1>
          <p className="text-sm text-muted mt-1">Keep every property covered, no gaps.</p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-white text-gray-900 shadow-xl overflow-hidden">
          <div className="px-6 pt-6 pb-5 border-b border-gray-100">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight">
                {formatMoney(price.unit_amount ?? 0, price.currency)}
              </span>
              {price.recurring && (
                <span className="text-sm text-gray-500">/ {price.recurring.interval}</span>
              )}
            </div>
            <ul className="mt-4 space-y-2">
              {INCLUDED.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-600 mt-0.5">✓</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="px-6 py-5">
            <SubscribeForm />
          </div>
        </div>

        <p className="text-xs text-muted text-center mt-4">Cancel anytime from your account page.</p>
      </div>
    </>
  );
}
