"use client";

import { useState } from "react";

export default function EmailQrForm({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const res = await fetch("/api/email-qr-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, email }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't send the email — please try again.");
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm border border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-900 print:hidden"
      >
        Email QR links
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-800 bg-gray-950 rounded-lg p-3 flex items-center gap-2 print:hidden"
    >
      <input
        type="email"
        required
        placeholder="cleaner@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-900 text-white placeholder:text-gray-500 focus:outline-none focus:border-green-600"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50 transition-colors"
      >
        {status === "sending" ? "Sending..." : "Send"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-muted hover:text-white"
      >
        Cancel
      </button>
      {status === "sent" && (
        <span className="text-sm text-green-400">Sent!</span>
      )}
      {error && <span className="text-sm text-red-400">{error}</span>}
    </form>
  );
}
