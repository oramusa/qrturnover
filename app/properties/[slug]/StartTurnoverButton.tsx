"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StartTurnoverButton({
  propertyId,
  hasActiveSession,
  activeSessionId,
  cleanerName,
  zoneCount,
  scannedCount,
}: {
  propertyId: string;
  hasActiveSession: boolean;
  activeSessionId?: string;
  cleanerName?: string | null;
  zoneCount: number;
  scannedCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: state updates that gate the button's `disabled` prop
  // aren't guaranteed to commit before a second rapid tap fires (especially
  // on mobile), which is exactly how duplicate in_progress sessions got
  // created. A ref is read/written synchronously, so it closes that gap.
  const startingRef = useRef(false);
  const router = useRouter();

  async function startTurnover() {
    if (startingRef.current) return;
    startingRef.current = true;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("turnover_sessions")
      .insert({ property_id: propertyId });

    startingRef.current = false;
    setLoading(false);

    if (insertError) {
      // A unique-turnover-per-property constraint violation just means
      // another tap already started one — not a real failure.
      if (insertError.code !== "23505") {
        setError(insertError.message);
        return;
      }
    }
    router.refresh();
  }

  async function completeTurnover() {
    const supabase = createClient();

    if (activeSessionId) {
      const { data: claim } = await supabase
        .from("property_set_claims")
        .select("set_id")
        .eq("property_id", propertyId)
        .is("released_at", null)
        .maybeSingle();

      const [{ data: zones }, { data: scans }] = await Promise.all([
        claim
          ? supabase.from("qr_set_zones").select("zone_slug, zone_label").eq("set_id", claim.set_id)
          : Promise.resolve({ data: [] as { zone_slug: string; zone_label: string }[] }),
        supabase.from("scan_events").select("zone_slug").eq("session_id", activeSessionId),
      ]);
      const scannedSlugs = new Set((scans ?? []).map((s) => s.zone_slug));
      const pending = (zones ?? []).filter((z) => !scannedSlugs.has(z.zone_slug));
      if (pending.length > 0) {
        const proceed = confirm(
          `${pending.length} zone${pending.length === 1 ? "" : "s"} not yet scanned: ${pending
            .map((z) => z.zone_label)
            .join(", ")}.\n\nMark this turnover complete anyway?`
        );
        if (!proceed) return;
      }
    }

    setLoading(true);
    const finishedAt = new Date().toISOString();
    await supabase
      .from("turnover_sessions")
      .update({ status: "complete", completed_at: finishedAt, job_finished_at: finishedAt })
      .eq("property_id", propertyId)
      .eq("status", "in_progress");
    setLoading(false);
    router.refresh();
  }

  if (hasActiveSession) {
    const progress = zoneCount > 0 ? Math.min(100, Math.round((scannedCount / zoneCount) * 100)) : 0;
    return (
      <div className="border border-gray-800 rounded-xl p-5 bg-gray-950 mt-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-medium">Live turnover</h2>
            <p className="text-xs text-muted mt-0.5">
              {cleanerName ? `${cleanerName} is working` : "Waiting for a cleaner to start"} · status
              updates automatically
            </p>
          </div>
          <button
            onClick={completeTurnover}
            disabled={loading}
            className="text-sm border border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-900 disabled:opacity-50 shrink-0"
          >
            {loading ? "Saving..." : "Mark complete"}
          </button>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mt-4">
          <div
            className="h-full bg-green-600 rounded-full transition-all"
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-xl p-5 bg-gray-950 mt-6 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h2 className="font-medium">Ready for the next turnover</h2>
        <p className="text-xs text-muted mt-0.5">
          Start a turnover to activate this property&apos;s scan links for your cleaner.
        </p>
      </div>
      <button
        onClick={startTurnover}
        disabled={loading}
        className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-50 shrink-0"
      >
        {loading ? "Starting..." : "Start turnover"}
      </button>
      {error && <p className="text-red-600 text-sm w-full">{error}</p>}
    </div>
  );
}
