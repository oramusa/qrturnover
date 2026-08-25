"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MailingAddressForm({
  initialAddress,
}: {
  initialAddress: string | null;
}) {
  const [address, setAddress] = useState(initialAddress ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

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
      .update({ mailing_address: address.trim() || null })
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
      <label className="block">
        <span className="text-xs text-muted">Mailing address</span>
        <p className="text-xs text-muted mb-1">
          Where printed QR sets should be shipped to you during beta testing.
        </p>
        <textarea
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setSaved(false);
          }}
          rows={3}
          placeholder="Street address, city, state, zip"
          disabled={saving}
          className="w-full border rounded px-3 py-2 text-sm bg-white text-gray-900"
        />
      </label>
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
