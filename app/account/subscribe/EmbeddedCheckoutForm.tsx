"use client";

import { useEffect, useRef } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function EmbeddedCheckoutForm() {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const stripe = await stripePromise;
      if (!stripe || cancelled || !containerRef.current) return;

      const checkout = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => {
          const res = await fetch("/api/stripe/checkout", { method: "POST" });
          const body = await res.json();
          return body.clientSecret;
        },
      });

      if (cancelled) {
        checkout.destroy();
        return;
      }
      checkoutRef.current = checkout;
      checkout.mount(containerRef.current);
    }

    mount();
    return () => {
      cancelled = true;
      checkoutRef.current?.destroy();
    };
  }, []);

  return <div ref={containerRef} />;
}
