"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function UpdatePaymentMethodForm({ onDone }: { onDone: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const res = await fetch("/api/stripe/setup-intent", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || cancelled) {
        if (!cancelled) setError(body.error ?? "Couldn't load the card form. Please try again.");
        return;
      }

      const stripe = await stripePromise;
      if (!stripe || cancelled) return;
      stripeRef.current = stripe;

      const elements = stripe.elements({ clientSecret: body.clientSecret });
      elementsRef.current = elements;
      const paymentElement = elements.create("payment");
      if (containerRef.current) paymentElement.mount(containerRef.current);
      setReady(true);
    }

    setup();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Couldn't save the card. Please try again.");
      setSubmitting(false);
      return;
    }

    const paymentMethodId =
      typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;

    if (paymentMethodId) {
      const res = await fetch("/api/stripe/set-default-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Card saved, but couldn't set it as default. Please try again.");
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 mt-3 bg-white text-gray-900">
      <div ref={containerRef} />
      {!ready && !error && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          disabled={!ready || submitting}
          className="bg-black text-white text-sm rounded px-4 py-2 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save card"}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-gray-500">
          Cancel
        </button>
      </div>
    </form>
  );
}
