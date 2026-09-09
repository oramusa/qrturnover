"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ChecklistItemsEditor from "@/components/ChecklistItemsEditor";

export default function ZoneChecklist({
  propertyId,
  zoneSlug,
  items,
  forceOpen,
}: {
  propertyId: string;
  zoneSlug: string;
  items: { id: string; label: string; sort_order: number }[];
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAdd(label: string) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("zone_checklist_items").insert({
      property_id: propertyId,
      zone_slug: zoneSlug,
      label,
      sort_order: items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0,
    });
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  async function handleEdit(id: string, label: string) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("zone_checklist_items").update({ label }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("zone_checklist_items").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className={forceOpen ? "" : "mt-2"}>
      {!forceOpen && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-muted underline"
        >
          Checklist ({items.length})
        </button>
      )}
      {isOpen && (
        <div className="mt-2 border rounded-lg p-3 bg-gray-50 text-gray-900">
          {forceOpen && (
            <p className="text-xs font-medium text-gray-500 mb-2">
              Checklist ({items.length})
            </p>
          )}
          <ChecklistItemsEditor
            items={items}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
