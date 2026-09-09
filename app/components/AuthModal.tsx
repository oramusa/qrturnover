"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot" | "forgot-sent";

type AuthModalContextValue = {
  openLogin: () => void;
  openSignup: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}

export default function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const router = useRouter();

  const openLogin = useCallback(() => setMode("login"), []);
  const openSignup = useCallback(() => setMode("signup"), []);
  const close = useCallback(() => setMode(null), []);

  useEffect(() => {
    if (!mode) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode, close]);

  return (
    <AuthModalContext.Provider value={{ openLogin, openSignup }}>
      {children}
      {mode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-sm bg-white text-gray-900 rounded-2xl shadow-xl p-6 sm:p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>

            {mode === "login" && (
              <LoginModalForm
                onSwitchToSignup={() => setMode("signup")}
                onSwitchToForgot={() => setMode("forgot")}
                onSuccess={() => {
                  close();
                  router.push("/dashboard");
                  router.refresh();
                }}
              />
            )}

            {mode === "signup" && (
              <SignupModalForm
                onSwitchToLogin={() => setMode("login")}
                onSuccess={() => {
                  close();
                  router.push("/dashboard");
                  router.refresh();
                }}
              />
            )}

            {mode === "forgot" && (
              <ForgotModalForm
                onSwitchToLogin={() => setMode("login")}
                onSent={() => setMode("forgot-sent")}
              />
            )}

            {mode === "forgot-sent" && (
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-3">Check your email</h2>
                <p className="text-sm text-gray-600">
                  If an account exists, we&apos;ve sent a link to reset your password.
                </p>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-sm text-emerald-700 underline mt-5"
                >
                  Back to log in
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AuthModalContext.Provider>
  );
}

function LoginModalForm({
  onSwitchToSignup,
  onSwitchToForgot,
  onSuccess,
}: {
  onSwitchToSignup: () => void;
  onSwitchToForgot: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    onSuccess();
  }

  return (
    <>
      <h2 className="text-xl font-semibold mb-6">Log in</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 bg-white text-gray-900"
        />
        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 bg-white text-gray-900"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white font-medium rounded-lg py-2 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="text-sm text-gray-600 mt-5">
        <button type="button" onClick={onSwitchToForgot} className="text-emerald-700 underline">
          Forgot password?
        </button>
      </p>
      <p className="text-sm text-gray-600 mt-2">
        No account yet?{" "}
        <button type="button" onClick={onSwitchToSignup} className="text-emerald-700 underline">
          Start free trial
        </button>
      </p>
    </>
  );
}

function SignupModalForm({
  onSwitchToLogin,
  onSuccess,
}: {
  onSwitchToLogin: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (!data.session) {
        setConfirmationPending(true);
        return;
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (confirmationPending) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-3">Check your email</h2>
        <p className="text-sm text-gray-600">
          Confirm your account via the link we sent to {email} before logging in.
        </p>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-sm text-emerald-700 underline mt-5"
        >
          Back to log in
        </button>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold mb-6">Create your host account</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 bg-white text-gray-900"
        />
        <input
          type="password"
          placeholder="Password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 bg-white text-gray-900"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white font-medium rounded-lg py-2 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Start free trial"}
        </button>
      </form>
      <p className="text-xs text-gray-600 mt-5">
        By creating an account, you agree to our{" "}
        <a href="/terms" className="text-emerald-700 underline">Terms of Use</a> and{" "}
        <a href="/privacy" className="text-emerald-700 underline">Privacy Policy</a>.
      </p>
      <p className="text-sm text-gray-600 mt-4">
        Already have an account?{" "}
        <button type="button" onClick={onSwitchToLogin} className="text-emerald-700 underline">
          Log in
        </button>
      </p>
    </>
  );
}

function ForgotModalForm({
  onSwitchToLogin,
  onSent,
}: {
  onSwitchToLogin: () => void;
  onSent: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    onSent();
  }

  return (
    <>
      <h2 className="text-xl font-semibold mb-2">Reset your password</h2>
      <p className="text-sm text-gray-600 mb-6">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 bg-white text-gray-900"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white font-medium rounded-lg py-2 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-gray-600 mt-5">
        <button type="button" onClick={onSwitchToLogin} className="text-emerald-700 underline">
          Back to log in
        </button>
      </p>
    </>
  );
}
