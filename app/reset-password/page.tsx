"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <div className="mx-auto max-w-sm mt-24 p-6">
      <h1 className="text-2xl font-semibold mb-6">Set a new password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="New password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 bg-white text-gray-900"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 bg-white text-gray-900"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Set new password"}
        </button>
      </form>
    </div>
  );
}
