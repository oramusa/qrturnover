"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeletePropertyButton({
  propertyId,
  propertyName,
}: {
  propertyId: string;
  propertyName: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${propertyName}"? This permanently removes all its zones, QR codes, cleaner assignments, and turnover history. This can't be undone.`
      )
    ) {
      return;
    }
    setLoading(true);
    const supabase = createClient();
    await supabase.from("properties").delete().eq("id", propertyId);
    router.push("/dashboard");
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-sm text-muted hover:text-red-600 disabled:opacity-50"
    >
      {loading ? "Deleting..." : "Delete property"}
    </button>
  );
}
