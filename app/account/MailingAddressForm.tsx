"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Address = {
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
};

export default function MailingAddressForm({ initialAddress }: { initialAddress: Address }) {
  const [addressLine, setAddressLine] = useState(initialAddress.address_line ?? "");
  const [city, setCity] = useState(initialAddress.city ?? "");
  const [state, setState] = useState(initialAddress.state ?? "");
  const [zipCode, setZipCode] = useState(initialAddress.zip_code ?? "");
  const [country, setCountry] = useState(initialAddress.country ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function markDirty() {
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("hosts")
      .update({
        address_line: addressLine.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip_code: zipCode.trim() || null,
        country: country.trim() || null,
      })
      .eq("id", user!.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-2">
      <p className="text-xs text-muted mb-1">
        Where printed QR sets should be shipped to you during beta testing.
      </p>
      <label className="block">
        <span className="text-xs text-muted">Street address</span>
        <input
          type="text"
          value={addressLine}
          onChange={(e) => {
            setAddressLine(e.target.value);
            markDirty();
          }}
          placeholder="123 Main St, Apt 4"
          disabled={saving}
          className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white text-gray-900"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-muted">City</span>
          <input
            type="text"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              markDirty();
            }}
            disabled={saving}
            className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white text-gray-900"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">State</span>
          <input
            type="text"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              markDirty();
            }}
            disabled={saving}
            className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white text-gray-900"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Zip code</span>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => {
              setZipCode(e.target.value);
              markDirty();
            }}
            disabled={saving}
            className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white text-gray-900"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Country</span>
          <input
            type="text"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              markDirty();
            }}
            disabled={saving}
            className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white text-gray-900"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white text-sm rounded px-4 py-2 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saved && <span className="text-sm text-green-700">Saved!</span>}
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </form>
  );
}
