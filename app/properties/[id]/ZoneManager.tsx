"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SUGGESTIONS = ["Kitchen", "Bathroom", "Bedroom", "Living Room", "Fridge", "Entryway"];

export default function ZoneManager({ propertyId }: { propertyId: string }) {
  const [name, setName] = useState("");
  const [checklist, setChecklist] = useState("");
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function addZone(zoneName: string, extra?: { checklist?: string; requirePhoto?: boolean }) {
    const trimmedZoneName = zoneName.trim();
    if (!trimmedZoneName) return;
    setLoading(true);
    const supabase = createClient();
    const { data: newZone } = await supabase
      .from("zones")
      .insert({
        property_id: propertyId,
        name: trimmedZoneName,
        checklist_items: extra?.checklist || null,
        require_photo: extra?.requirePhoto ?? false,
      })
      .select("id")
      .single();

    if (newZone) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: templates } = await supabase
        .from("checklist_templates")
        .select("id, room_type, checklist_template_items ( label, sort_order )")
        .eq("host_id", user!.id);

      const match = templates?.find(
        (t) => t.room_type.toLowerCase() === trimmedZoneName.toLowerCase()
      );
      if (match && match.checklist_template_items.length > 0) {
        await supabase.from("zone_checklist_items").insert(
          match.checklist_template_items.map((item) => ({
            zone_id: newZone.id,
            label: item.label,
            sort_order: item.sort_order,
          }))
        );
      } else if (extra?.checklist && extra.checklist.trim() !== "") {
        const lines = extra.checklist
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "");
        if (lines.length > 0) {
          await supabase.from("zone_checklist_items").insert(
            lines.map((label, index) => ({
              zone_id: newZone.id,
              label,
              sort_order: index,
            }))
          );
        }
      }
    }

    setName("");
    setChecklist("");
    setRequirePhoto(false);
    setExpanded(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="border-t pt-4">
      <h3 className="text-sm font-medium mb-2">Add a zone</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addZone(name, { checklist, requirePhoto });
        }}
        className="space-y-2 mb-3"
      >
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="e.g. Bathroom 2"
            className="border rounded px-3 py-2 text-sm flex-1 bg-white text-gray-900"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white text-sm rounded px-4 py-2 disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {expanded && (
          <div className="border rounded-lg p-3 space-y-2 bg-gray-50 text-gray-900">
            <label className="block">
              <span className="text-xs text-gray-500">
                Checklist for the cleaner (one item per line — shown on their phone)
              </span>
              <textarea
                value={checklist}
                onChange={(e) => setChecklist(e.target.value)}
                placeholder={"Toilet paper stocked\nNo hair in drain\nTowels folded"}
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white text-gray-900"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requirePhoto}
                onChange={(e) => setRequirePhoto(e.target.checked)}
              />
              Require a photo before this zone can be marked done
            </label>
          </div>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => addZone(s)}
            className="text-xs border rounded-full px-3 py-1 hover:bg-gray-50 hover:text-gray-900"
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}
