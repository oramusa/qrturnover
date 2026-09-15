"use client";

import { useState } from "react";

export default function OrderButton({ propertyId }: { propertyId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/qr-kit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) {
        throw new Error(body.error || "Couldn't start checkout.");
      }
      window.location.assign(body.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Couldn't start checkout.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-medium rounded-xl px-5 py-3.5"
      >
        {loading ? "Opening secure checkout…" : "Continue to secure checkout"}
      </button>
      {error && <p className="text-sm text-red-400 mt-3" role="alert">{error}</p>}
    </div>
  );
}
