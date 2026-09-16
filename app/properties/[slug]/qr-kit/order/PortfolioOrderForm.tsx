"use client";

import { useMemo, useState } from "react";
import {
  calculateQrKitPrice,
  MAX_QR_KIT_PROPERTIES,
  QR_KIT_ADDITIONAL_PROPERTY_CENTS,
  QR_KIT_FIRST_PROPERTY_CENTS,
} from "@/lib/qrKitPricing";

type OrderProperty = {
  id: string;
  name: string;
  address: string | null;
  roomCount: number;
  isCurrent: boolean;
};

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function PortfolioOrderForm({
  properties,
  address,
}: {
  properties: OrderProperty[];
  address: string | null;
}) {
  const currentProperty = properties.find((property) => property.isCurrent);
  const [selectedIds, setSelectedIds] = useState<string[]>(currentProperty ? [currentProperty.id] : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedProperties = useMemo(
    () => properties.filter((property) => selectedIds.includes(property.id)),
    [properties, selectedIds],
  );
  const totalCents = calculateQrKitPrice(selectedProperties.length);
  const regularCents = selectedProperties.length * QR_KIT_FIRST_PROPERTY_CENTS;
  const savingsCents = regularCents - totalCents;

  function toggleProperty(propertyId: string) {
    setError("");
    setSelectedIds((current) => {
      if (current.includes(propertyId)) return current.filter((id) => id !== propertyId);
      if (current.length >= MAX_QR_KIT_PROPERTIES) {
        setError(`You can include up to ${MAX_QR_KIT_PROPERTIES} properties in one order.`);
        return current;
      }
      return [...current, propertyId];
    });
  }

  async function startCheckout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/qr-kit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyIds: selectedIds }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.error || "Couldn't start checkout.");
      window.location.assign(body.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Couldn't start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_0.72fr] gap-6 mt-8 items-start">
      <section className="border border-gray-800 rounded-2xl bg-gray-950 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-green-400">Your portfolio</p>
            <h2 className="text-xl font-semibold mt-1">Choose properties for this shipment</h2>
            <p className="text-sm text-gray-400 mt-2">The first kit is $39. Every additional property is only $15.</p>
          </div>
          <span className="rounded-full bg-green-950 text-green-300 text-xs px-3 py-1.5">
            {selectedProperties.length} selected
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {properties.map((property) => {
            const selected = selectedIds.includes(property.id);
            const unavailable = property.roomCount === 0;
            return (
              <label
                key={property.id}
                className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                  unavailable
                    ? "cursor-not-allowed border-gray-900 bg-gray-950 opacity-55"
                    : selected
                      ? "cursor-pointer border-green-600 bg-green-950/30"
                      : "cursor-pointer border-gray-800 bg-gray-900/50 hover:border-gray-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={property.isCurrent || unavailable}
                  onChange={() => toggleProperty(property.id)}
                  className="mt-1 h-4 w-4 accent-green-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-100">{property.name}</span>
                    {property.isCurrent && <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300">Current property</span>}
                  </span>
                  {property.address && <span className="mt-1 block truncate text-xs text-gray-500">{property.address}</span>}
                </span>
                <span className={`shrink-0 text-xs ${unavailable ? "text-amber-300" : "text-gray-300"}`}>
                  {unavailable ? "No rooms" : `${property.roomCount} room${property.roomCount === 1 ? "" : "s"}`}
                </span>
              </label>
            );
          })}
        </div>

        <ul className="mt-6 grid gap-3 text-sm text-gray-300 sm:grid-cols-2">
          <li className="flex gap-2"><span className="text-green-400">✓</span>One waterproof card for every room</li>
          <li className="flex gap-2"><span className="text-green-400">✓</span>Room names printed on every card</li>
          <li className="flex gap-2"><span className="text-green-400">✓</span>One combined shipment</li>
          <li className="flex gap-2"><span className="text-green-400">✓</span>Free US shipping</li>
        </ul>
      </section>

      <aside className="border border-gray-800 rounded-2xl bg-gray-950 p-5 sm:p-6 lg:sticky lg:top-24">
        <h2 className="font-semibold">Order summary</h2>
        <div className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4"><span>{selectedProperties[0]?.name}</span><span>{dollars.format(QR_KIT_FIRST_PROPERTY_CENTS / 100)}</span></div>
          {selectedProperties.slice(1).map((property) => (
            <div key={property.id} className="flex justify-between gap-4 text-gray-300">
              <span className="truncate">{property.name}</span>
              <span>{dollars.format(QR_KIT_ADDITIONAL_PROPERTY_CENTS / 100)}</span>
            </div>
          ))}
          <div className="flex justify-between text-gray-400"><span>US shipping</span><span>Included</span></div>
        </div>
        {savingsCents > 0 && (
          <div className="mt-4 rounded-lg bg-green-950/50 px-3 py-2 text-sm text-green-300">
            Portfolio savings: {dollars.format(savingsCents / 100)}
          </div>
        )}
        <div className="border-t border-gray-800 mt-5 pt-5 flex items-end justify-between">
          <span className="font-semibold">Total</span>
          <div className="text-right"><span className="block text-2xl font-semibold">{dollars.format(totalCents / 100)}</span><span className="text-[11px] text-gray-500">one-time payment</span></div>
        </div>

        <div className="mt-6 mb-5 rounded-xl bg-gray-900 p-4">
          <p className="text-xs text-gray-400">Saved delivery address</p>
          <p className="text-sm mt-1.5 text-gray-200">{address || "No complete mailing address saved."}</p>
          <p className="text-xs text-gray-500 mt-2">You can confirm or change it securely in Stripe.</p>
        </div>

        <button
          type="button"
          onClick={startCheckout}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-medium rounded-xl px-5 py-3.5"
        >
          {loading ? "Opening secure checkout…" : `Review and order · ${dollars.format(totalCents / 100)}`}
        </button>
        {error && <p className="text-sm text-red-400 mt-3" role="alert">{error}</p>}
        <p className="text-[11px] text-gray-500 text-center mt-3">Your subscription will not change.</p>
      </aside>
    </div>
  );
}
