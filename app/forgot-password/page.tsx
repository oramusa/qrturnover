"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="mx-auto max-w-sm mt-24 p-6 text-center">
        <h1 className="text-2xl font-semibold mb-4">Check your email</h1>
        <p className="text-sm text-muted">
          If an account exists for {email}, we&apos;ve sent a link to reset your password.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm mt-24 p-6">
      <h1 className="text-2xl font-semibold mb-2">Reset your password</h1>
      <p className="text-sm text-muted mb-6">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 bg-white text-gray-900"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
        >
          {status === "sending" ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-muted mt-4">
        <a href="/login" className="underline">
          Back to log in
        </a>
      </p>
    </div>
  );
}
