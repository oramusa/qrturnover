"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StartTurnoverButton({
  propertyId,
  hasActiveSession,
  activeSessionId,
}: {
  propertyId: string;
  hasActiveSession: boolean;
  activeSessionId?: string;
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
    await supabase
      .from("turnover_sessions")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("property_id", propertyId)
      .eq("status", "in_progress");
    setLoading(false);
    router.refresh();
  }

  if (hasActiveSession) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded">
          Turnover in progress — share the property&apos;s scan links or printed QR codes with your cleaner.
        </span>
        <button
          onClick={completeTurnover}
          disabled={loading}
          className="text-sm border rounded px-3 py-2 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
        >
          Mark complete
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={startTurnover}
        disabled={loading}
        className="bg-black text-white text-sm rounded px-4 py-2 disabled:opacity-50"
      >
        {loading ? "Starting..." : "Start turnover"}
      </button>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
