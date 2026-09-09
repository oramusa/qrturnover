"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Only ever follow a same-site relative path here — the redirect param comes
// from a URL query string, so treating it as trustworthy (e.g. passing a
// full external URL through) would be an open-redirect vector.
function safeRedirectTarget(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "confirmation-failed"
      ? "That confirmation link didn't work — it may have expired. Try signing in, or sign up again to get a new one."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(safeRedirectTarget(searchParams.get("redirect")));
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <span className="bg-white rounded-md p-1 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="w-6 h-6 object-contain" />
          </span>
          <span className="font-semibold tracking-tight">QRTurnover</span>
        </Link>

        <div className="border border-gray-800 rounded-xl bg-gray-950 p-6 sm:p-8">
          <h1 className="text-xl font-semibold mb-6">Log in</h1>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-white placeholder:text-gray-500 focus:outline-none focus:border-green-600"
            />
            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-white placeholder:text-gray-500 focus:outline-none focus:border-green-600"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg py-2 disabled:opacity-50 transition-colors"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
          <p className="text-sm text-muted mt-5">
            <a href="/forgot-password" className="text-green-400 hover:text-green-300">
              Forgot password?
            </a>
          </p>
          <p className="text-sm text-muted mt-2">
            No account yet?{" "}
            <a href="/signup" className="text-green-400 hover:text-green-300">
              Start free trial
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
