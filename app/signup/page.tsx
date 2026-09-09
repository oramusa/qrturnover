"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // The matching hosts row is created server-side by the on_auth_user_created
      // trigger (see supabase/schema.sql), since the browser has no session yet
      // while email confirmation is pending.
      if (!data.session) {
        // Email confirmation is required before a session (and dashboard access) exists.
        setError("Check your email to confirm your account before logging in.");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-xl font-semibold mb-6">Create your host account</h1>
          <form onSubmit={handleSignup} className="space-y-3">
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
              minLength={6}
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
              {loading ? "Creating account..." : "Start free trial"}
            </button>
          </form>
          <p className="text-xs text-muted mt-5">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-green-400 hover:text-green-300">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-green-400 hover:text-green-300">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="text-sm text-muted mt-4">
            Already have an account?{" "}
            <a href="/login" className="text-green-400 hover:text-green-300">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
