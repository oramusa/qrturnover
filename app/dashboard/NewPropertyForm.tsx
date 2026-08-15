"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

    const { data, error: insertError } = await supabase
      .from("properties")
      .insert({ host_id: user.id, name, address: address || null })
      .select()
      .single();

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      router.push(`/properties/${data.id}`);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 hover:text-gray-900"
      >
        + Add property
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 max-w-sm bg-white text-gray-900">
      <input
        placeholder="Property name (e.g. Lakeview Apt 2B)"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm bg-white text-gray-900"
      />
      <input
        placeholder="Address (optional)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm bg-white text-gray-900"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white text-sm rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create & add zones"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
