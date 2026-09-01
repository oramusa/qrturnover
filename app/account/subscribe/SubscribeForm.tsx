"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function SubscribeForm() {
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
      const res = await fetch("/api/stripe/create-subscription", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || cancelled) {
        if (!cancelled) setError(body.error ?? "Couldn't load the subscribe form. Please try again.");
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

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/account?checkout=success` },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Couldn't complete the subscription. Please try again.");
      setSubmitting(false);
      return;
    }

    router.push("/account?checkout=success");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 bg-white text-gray-900">
      <div ref={containerRef} />
      {!ready && !error && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      <button
        type="submit"
        disabled={!ready || submitting}
        className="w-full bg-black text-white text-sm rounded py-2.5 mt-4 disabled:opacity-50"
      >
        {submitting ? "Subscribing..." : "Subscribe"}
      </button>
    </form>
  );
}
