"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slugify";

export default function NewPropertyForm() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You're not logged in. Please log in again.");
      setLoading(false);
      return;
    }

    const { data: existingProps } = await supabase
      .from("properties")
      .select("slug")
      .eq("host_id", user.id);
    const existingSlugs = new Set((existingProps ?? []).map((p) => p.slug).filter(Boolean));
    const base = slugify(name) || "property";
    let slug = base;
    let n = 2;
    while (existingSlugs.has(slug)) {
      slug = `${base}-${n}`;
      n++;
    }

    const { data: property, error: insertError } = await supabase
      .from("properties")
      .insert({ host_id: user.id, name, address: address || null, slug })
      .select()
      .single();

    if (insertError || !property) {
      setLoading(false);
      setError(insertError?.message ?? "Couldn't create the property.");
      return;
    }

    // Atomically claim the next available physical QR set for this property.
    const { data: setId, error: claimError } = await supabase.rpc("claim_next_qr_set", {
      p_property_id: property.id,
    });

    if (claimError || !setId) {
      // Don't leave an orphaned property with no QR set attached.
      await supabase.from("properties").delete().eq("id", property.id);
      setLoading(false);
      setError(
        claimError?.message.includes("No unclaimed QR sets")
          ? "No QR sets are available to assign right now. Please contact support."
          : claimError?.message ?? "Couldn't claim a QR set for this property."
      );
      return;
    }

    fetch("/api/notify-new-property", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: property.id }),
    }).catch(() => {});

    setLoading(false);
    router.push(`/properties/${property.slug}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-green-500 shadow-lg shadow-green-950/30"
      >
        + Add property
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-800 rounded-xl p-4 space-y-3 max-w-sm bg-gray-950 text-white">
      <input
        placeholder="Property name (e.g. Lakeview Apt 2B)"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-gray-900 text-white"
      />
      <input
        placeholder="Address (optional)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="w-full border border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-gray-900 text-white"
      />
      <p className="text-xs text-muted">
        The next available QR sticker set will be automatically assigned to this property.
      </p>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create property"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-white px-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
