"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STARTER_TEMPLATE_PACKS } from "@/lib/starterTemplates";

export default function StarterTemplatePicker() {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function applyPack(packId: string) {
    const pack = STARTER_TEMPLATE_PACKS.find((p) => p.id === packId);
    if (!pack) return;

    setApplyingId(packId);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're not logged in. Please log in again.");
      setApplyingId(null);
      return;
    }

    for (const room of pack.rooms) {
      const { data: template, error: templateError } = await supabase
        .from("checklist_templates")
        .upsert(
          { host_id: user.id, room_type: room.roomType },
          { onConflict: "host_id,room_type" }
        )
        .select("id")
        .single();

      if (templateError || !template) {
        setError(templateError?.message ?? "Couldn't create the template.");
        setApplyingId(null);
        return;
      }

      const { error: deleteError } = await supabase
        .from("checklist_template_items")
        .delete()
        .eq("template_id", template.id);
      if (deleteError) {
        setError(deleteError.message);
        setApplyingId(null);
        return;
      }

      const { error: itemsError } = await supabase.from("checklist_template_items").insert(
        room.items.map((label, i) => ({
          template_id: template.id,
          label,
          sort_order: i,
        }))
      );
      if (itemsError) {
        setError(itemsError.message);
        setApplyingId(null);
        return;
      }
    }

    setApplyingId(null);
    router.refresh();
  }

  return (
    <div className="mt-9">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-medium">Start with a proven pack</h2>
          <p className="text-xs text-muted mt-1">Set up four room templates in one click, then customize every task.</p>
        </div>
        <span className="hidden sm:block text-[11px] text-gray-500">Replaces matching templates</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {STARTER_TEMPLATE_PACKS.map((pack, index) => (
          <div key={pack.id} className={`border rounded-xl p-5 flex flex-col bg-gray-950 ${index === 1 ? "border-green-700 ring-1 ring-green-900" : "border-gray-800"}`}>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{pack.name}</p>
                {index === 1 && <span className="text-[10px] uppercase tracking-wider text-green-300 bg-green-950 rounded-full px-2 py-1">Recommended</span>}
              </div>
              <p className="text-xs text-muted mt-2 leading-relaxed min-h-12">{pack.description}</p>
            </div>
            <button
              type="button"
              onClick={() => applyPack(pack.id)}
              disabled={applyingId !== null}
              className={`mt-4 text-sm rounded-lg px-3 py-2.5 disabled:opacity-50 w-full font-medium ${index === 1 ? "bg-green-600 text-white hover:bg-green-500" : "border border-gray-700 hover:border-gray-500"}`}
            >
              {applyingId === pack.id ? "Applying..." : "Use this pack"}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
