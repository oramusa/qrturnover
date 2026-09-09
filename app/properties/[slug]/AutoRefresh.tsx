"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Refreshes the host's view while a turnover is active. Realtime pushes updates
// the instant a cleaner scans a zone or checks off an item; the interval below
// is just a fallback in case the websocket connection drops.
const FALLBACK_POLL_MS = 20000;

export default function AutoRefresh({
  enabled,
  sessionId,
}: {
  enabled: boolean;
  sessionId?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => router.refresh(), FALLBACK_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, router]);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`turnover-session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scan_events", filter: `session_id=eq.${sessionId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scan_item_completions", filter: `session_id=eq.${sessionId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "turnover_sessions", filter: `id=eq.${sessionId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, sessionId, router]);

  return null;
}
