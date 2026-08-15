"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteCleanerButton({
  cleanerId,
  cleanerName,
}: {
  cleanerId: string;
  cleanerName: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (
      !confirm(
        `Remove ${cleanerName}? Their access code will stop working and they'll be unassigned from all properties. Past turnover history is kept.`
      )
    ) {
      return;
    }
    setLoading(true);
    const supabase = createClient();
    await supabase.from("cleaners").delete().eq("id", cleanerId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
    >
      Remove
    </button>
  );
}
