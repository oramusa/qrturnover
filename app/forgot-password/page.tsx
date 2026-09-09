"use client";

import { useState } from "react";
import Link from "next/link";
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
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2 justify-center mb-8 group">
            <span className="bg-white rounded-md p-1 flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.png" alt="" className="w-6 h-6 object-contain" />
            </span>
            <span className="font-semibold tracking-tight group-hover:text-green-400 transition-colors">QRTurnover</span>
          </Link>
          <div className="border border-gray-800 rounded-xl bg-gray-950 p-6 sm:p-8 text-center">
            <h1 className="text-xl font-semibold mb-4">Check your email</h1>
            <p className="text-sm text-muted">
              If an account exists for {email}, we&apos;ve sent a link to reset your password.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8 group">
          <span className="bg-white rounded-md p-1 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="w-6 h-6 object-contain" />
          </span>
          <span className="font-semibold tracking-tight group-hover:text-green-400 transition-colors">QRTurnover</span>
        </Link>

        <div className="border border-gray-800 rounded-xl bg-gray-950 p-6 sm:p-8">
          <h1 className="text-xl font-semibold mb-2">Reset your password</h1>
          <p className="text-sm text-muted mb-6">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-white placeholder:text-gray-500 focus:outline-none focus:border-green-600"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg py-2 disabled:opacity-50 transition-colors"
            >
              {status === "sending" ? "Sending..." : "Send reset link"}
            </button>
          </form>
          <p className="text-sm text-muted mt-5">
            <a href="/login" className="text-green-400 hover:text-green-300">
              Back to log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
