"use client";

import { useAuthModal } from "./AuthModal";

export default function AuthTriggerButton({
  mode,
  className,
  children,
}: {
  mode: "login" | "signup";
  className?: string;
  children: React.ReactNode;
}) {
  const { openLogin, openSignup } = useAuthModal();

  return (
    <button
      type="button"
      onClick={mode === "login" ? openLogin : openSignup}
      className={className}
    >
      {children}
    </button>
  );
}
