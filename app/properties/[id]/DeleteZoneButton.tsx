"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteZoneButton({ zoneId, zoneName }: { zoneId: string; zoneName: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete "${zoneName}"? This removes its QR code and scan history — this can't be undone.`)) {
      return;
    }
    setLoading(true);
    const supabase = createClient();
    await supabase.from("zones").delete().eq("id", zoneId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      aria-label={`Delete ${zoneName}`}
      className="text-xs text-gray-400 hover:text-red-600 shrink-0 disabled:opacity-50"
    >
      Delete
    </button>
  );
}
