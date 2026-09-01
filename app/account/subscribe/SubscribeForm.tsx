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
    <form onSubmit={handleSubmit}>
      <div ref={containerRef} className="min-h-[1px]" />

      {!ready && !error && (
        <div className="space-y-3 animate-pulse">
          <div className="h-10 rounded-md bg-gray-100" />
          <div className="h-10 rounded-md bg-gray-100" />
          <div className="h-10 rounded-md bg-gray-100 w-2/3" />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="w-full bg-black text-white text-sm font-medium rounded-lg py-3 mt-5 transition hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-black"
      >
        {submitting ? "Subscribing…" : "Subscribe"}
      </button>
    </form>
  );
}
