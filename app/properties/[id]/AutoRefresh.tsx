"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls the server for fresh data while a turnover is active, so the host
// sees zones flip from Pending to Done without needing to manually reload.
export default function AutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [enabled, router]);

  return null;
}
