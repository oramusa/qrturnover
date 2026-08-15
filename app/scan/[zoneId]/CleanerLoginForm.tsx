"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CleanerLoginForm({ zoneId }: { zoneId: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/cleaner-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zoneId, code }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Access code"
        autoFocus
        autoCapitalize="characters"
        className="w-full border rounded px-4 py-3 text-lg tracking-widest text-center uppercase"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !code}
        className="w-full bg-black text-white rounded py-3 font-medium disabled:opacity-50"
      >
        {loading ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}
