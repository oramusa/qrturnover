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
      <div className="max-w-lg mx-auto p-6 mt-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold">Subscribe to QRTurnover</h1>
          <p className="text-sm text-muted mt-1">Keep every property covered, no gaps.</p>
        </div>

        <ul className="mb-6 space-y-2">
          {INCLUDED.map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-muted">
              <span className="text-green-500 mt-0.5">✓</span>
              {line}
            </li>
          ))}
        </ul>

        <EmbeddedCheckoutForm />
      </div>
    </>
  );
}
