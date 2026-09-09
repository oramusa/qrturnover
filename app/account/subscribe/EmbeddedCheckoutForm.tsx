"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function EmbeddedCheckoutForm() {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const stripe = await stripePromise;
      if (!stripe || cancelled || !containerRef.current) {
        if (!cancelled) {
          setError("Secure checkout couldn't load. Please refresh and try again.");
          setLoading(false);
        }
        return;
      }

      try {
        const checkout = await stripe.createEmbeddedCheckoutPage({
          fetchClientSecret: async () => {
            const res = await fetch("/api/stripe/checkout", { method: "POST" });
            const body = await res.json();
            if (!res.ok || !body.clientSecret) {
              throw new Error(body.error || "Couldn't start checkout.");
            }
            return body.clientSecret;
          },
        });

        if (cancelled) {
          checkout.destroy();
          return;
        }
        checkoutRef.current = checkout;
        checkout.mount(containerRef.current);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Secure checkout couldn't load.");
          setLoading(false);
        }
      }
    }

    mount();
    return () => {
      cancelled = true;
      checkoutRef.current?.destroy();
    };
  }, []);

  return (
    <div className="relative min-h-[620px]">
      {loading && (
        <div className="absolute inset-0 bg-white text-gray-600 flex items-center justify-center text-sm">
          Loading secure checkout…
        </div>
      )}
      {error && (
        <div className="p-6 text-center text-sm text-red-700 bg-red-50" role="alert">
          {error}
        </div>
      )}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
