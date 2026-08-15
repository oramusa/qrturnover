"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StartTurnoverButton({
  propertyId,
  hasActiveSession,
}: {
  propertyId: string;
  hasActiveSession: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function startTurnover() {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("turnover_sessions").insert({ property_id: propertyId });
    setLoading(false);
    router.refresh();
  }

  async function completeTurnover() {
    setLoading(true);
    const supabase = createClient();
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
          Turnover in progress — share the property's scan links or printed QR codes with your cleaner.
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
    <button
      onClick={startTurnover}
      disabled={loading}
      className="bg-black text-white text-sm rounded px-4 py-2 disabled:opacity-50"
    >
      {loading ? "Starting..." : "Start turnover"}
    </button>
  );
}
