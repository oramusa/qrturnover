"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STARTER_TEMPLATE_PACKS } from "@/lib/starterTemplates";

export default function StarterTemplatePicker({
  existingRoomTypes,
}: {
  existingRoomTypes: string[];
}) {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skippedRooms, setSkippedRooms] = useState<string[] | null>(null);
  const router = useRouter();

  const existingLower = new Set(existingRoomTypes.map((r) => r.toLowerCase()));

  async function applyPack(packId: string) {
    const pack = STARTER_TEMPLATE_PACKS.find((p) => p.id === packId);
    if (!pack) return;

    setApplyingId(packId);
    setError(null);
    setSkippedRooms(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're not logged in. Please log in again.");
      setApplyingId(null);
      return;
    }

    const roomsToAdd = pack.rooms.filter((r) => !existingLower.has(r.roomType.toLowerCase()));
    const roomsSkipped = pack.rooms
      .filter((r) => existingLower.has(r.roomType.toLowerCase()))
      .map((r) => r.roomType);

    for (const room of roomsToAdd) {
      const { data: template, error: templateError } = await supabase
        .from("checklist_templates")
        .insert({ host_id: user.id, room_type: room.roomType })
        .select("id")
        .single();

      if (templateError || !template) {
        setError(templateError?.message ?? "Couldn't create the template.");
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
    setSkippedRooms(roomsSkipped.length > 0 ? roomsSkipped : null);
    router.refresh();
  }

  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium mb-1">Start from a template pack</h2>
      <p className="text-xs text-gray-500 mb-3">
        Seeds Kitchen, Bathroom, Bedroom, and Living Room templates with common items — you
        can add, edit, or remove items afterward. Won&apos;t overwrite a room type you already
        have a template for.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {STARTER_TEMPLATE_PACKS.map((pack) => (
          <div key={pack.id} className="border rounded-lg p-4">
            <p className="font-medium">{pack.name}</p>
            <p className="text-xs text-gray-500 mt-1">{pack.description}</p>
            <button
              type="button"
              onClick={() => applyPack(pack.id)}
              disabled={applyingId !== null}
              className="mt-3 text-sm border rounded px-3 py-2 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 w-full"
            >
              {applyingId === pack.id ? "Adding..." : "Use this pack"}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      {skippedRooms && (
        <p className="text-xs text-gray-500 mt-2">
          You already had templates for {skippedRooms.join(", ")} — those were left as-is.
        </p>
      )}
    </div>
  );
}
