import AppNav from "@/app/components/AppNav";
import EmbeddedCheckoutForm from "./EmbeddedCheckoutForm";

const INCLUDED = [
  "Unlimited properties and zones",
  "QR-code cleaning verification for every turnover",
  "Cleaner verification and photo proof",
  "Full turnover history and reporting",
];

export default function SubscribePage() {
  return (
    <>
      <AppNav current="/account" />
      <div className="max-w-6xl mx-auto p-6 sm:py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-500 mb-2">
            Simple pricing
          </p>
          <h1 className="text-3xl font-semibold">Subscribe to QRTurnover</h1>
          <p className="text-sm text-muted mt-2">Keep every property covered, no gaps.</p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,0.8fr)_minmax(480px,1.2fr)] gap-6 items-start">
          <section className="border border-gray-800 rounded-2xl p-6 bg-gray-950 lg:sticky lg:top-6">
            <p className="text-xs text-muted">Monthly subscription</p>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-4xl font-semibold">$19</span>
              <span className="text-sm text-muted pb-1">per month</span>
            </div>
            <p className="text-xs text-muted mt-2">Cancel anytime from your account.</p>

            <div className="border-t border-gray-800 mt-6 pt-6">
              <p className="text-sm font-medium mb-4">Everything included</p>
              <ul className="space-y-3">
                {INCLUDED.map((line) => (
                  <li key={line} className="flex items-start gap-3 text-sm text-muted">
                    <span className="w-5 h-5 rounded-full bg-green-950 text-green-300 flex items-center justify-center shrink-0 text-xs">
                      ✓
                    </span>
                    <span className="pt-0.5">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-blue-900/60 bg-blue-950/30 rounded-xl p-4 mt-6">
              <p className="text-xs text-blue-100/80 leading-relaxed">
                Secure payment processing by Stripe. Your payment details are never stored by QRTurnover.
              </p>
            </div>
          </section>

          <section className="border border-gray-800 rounded-2xl bg-gray-950 overflow-hidden min-w-0">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">Secure checkout</h2>
                <p className="text-xs text-muted mt-1">Complete your subscription below.</p>
              </div>
              <span className="text-xs text-green-300 bg-green-950 rounded-full px-2.5 py-1 whitespace-nowrap">
                Powered by Stripe
              </span>
            </div>
            <div className="bg-white min-h-[620px]">
              <EmbeddedCheckoutForm />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
