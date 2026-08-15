"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CleanerAssignment({
  propertyId,
  allCleaners,
  assignedIds,
}: {
  propertyId: string;
  allCleaners: { id: string; name: string }[];
  assignedIds: string[];
}) {
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();
  const assigned = new Set(assignedIds);

  async function toggle(cleanerId: string) {
    setPending(cleanerId);
    const supabase = createClient();

    if (assigned.has(cleanerId)) {
      await supabase
        .from("property_cleaners")
        .delete()
        .eq("property_id", propertyId)
        .eq("cleaner_id", cleanerId);
    } else {
      await supabase
        .from("property_cleaners")
        .insert({ property_id: propertyId, cleaner_id: cleanerId });
    }

    setPending(null);
    router.refresh();
  }

  if (allCleaners.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No cleaners on your roster yet —{" "}
        <a href="/cleaners" className="underline">
          add one
        </a>{" "}
        first, then assign them here.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allCleaners.map((cleaner) => {
        const isAssigned = assigned.has(cleaner.id);
        return (
          <button
            key={cleaner.id}
            onClick={() => toggle(cleaner.id)}
            disabled={pending === cleaner.id}
            className={`text-sm rounded-full px-3 py-1.5 border disabled:opacity-50 ${
              isAssigned
                ? "bg-black text-white border-black"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {isAssigned ? "✓ " : "+ "}
            {cleaner.name}
          </button>
        );
      })}
    </div>
  );
}
