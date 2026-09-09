"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center mb-2 group">
          <span className="bg-white rounded-md p-1 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="w-6 h-6 object-contain" />
          </span>
          <span className="font-semibold tracking-tight group-hover:text-green-400 transition-colors">QRTurnover</span>
        </Link>
        <p className="text-center mb-8">
          <Link href="/" className="text-xs text-muted underline hover:text-green-400">
            Home
          </Link>
        </p>

        <div className="border border-gray-800 rounded-xl bg-gray-950 p-6 sm:p-8">
          <h1 className="text-xl font-semibold mb-6">Set a new password</h1>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="New password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-white placeholder:text-gray-500 focus:outline-none focus:border-green-600"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-white placeholder:text-gray-500 focus:outline-none focus:border-green-600"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg py-2 disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving..." : "Set new password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
