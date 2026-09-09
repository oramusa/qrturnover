"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function randomCode() {
  // Short, easy to read/type over text — avoids ambiguous chars like 0/O, 1/I
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function NewCleanerForm() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
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

    const { error: insertError } = await supabase.from("cleaners").insert({
      host_id: user.id,
      name,
      contact: contact || null,
      access_code: randomCode(),
    });

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    setContact("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-green-500 shadow-lg shadow-green-950/30"
      >
        + Add cleaner
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-700 rounded-xl p-4 space-y-3 w-full sm:w-96 bg-gray-950">
      <input
        placeholder="Cleaner's name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-gray-900 text-white"
      />
      <input
        placeholder="Phone or email (optional)"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        className="w-full border border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-gray-900 text-white"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add cleaner"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">
          Cancel
        </button>
      </div>
    </form>
  );
}
