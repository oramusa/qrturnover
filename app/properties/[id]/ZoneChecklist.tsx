"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ChecklistItemsEditor from "@/components/ChecklistItemsEditor";

export default function ZoneChecklist({
  zoneId,
  zoneName,
  items,
}: {
  zoneId: string;
  zoneName: string;
  items: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleAdd(label: string) {
    const supabase = createClient();
    await supabase.from("zone_checklist_items").insert({
      zone_id: zoneId,
      label,
      sort_order: items.length,
    });
    router.refresh();
  }

  async function handleEdit(id: string, label: string) {
    const supabase = createClient();
    await supabase.from("zone_checklist_items").update({ label }).eq("id", id);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("zone_checklist_items").delete().eq("id", id);
    router.refresh();
  }

  async function handleSaveAsTemplate() {
    if (items.length === 0) {
      alert("Add at least one item before saving this as a template.");
      return;
    }
    if (
      !confirm(
        `Save these ${items.length} items as your "${zoneName}" template? This replaces that template's current items (if any). Existing zones are not affected.`
      )
    ) {
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: template } = await supabase
      .from("checklist_templates")
      .upsert(
        { host_id: user!.id, room_type: zoneName },
        { onConflict: "host_id,room_type" }
      )
      .select("id")
      .single();

    if (template) {
      await supabase.from("checklist_template_items").delete().eq("template_id", template.id);
      await supabase.from("checklist_template_items").insert(
        items.map((item, i) => ({
          template_id: template.id,
          label: item.label,
          sort_order: i,
        }))
      );
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-500 underline"
      >
        Checklist ({items.length})
      </button>
      {open && (
        <div className="mt-2 border rounded-lg p-3 bg-gray-50 text-gray-900">
          <ChecklistItemsEditor items={items} onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete} />
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            disabled={saving}
            className="text-xs text-gray-500 hover:text-gray-900 mt-3 disabled:opacity-50"
          >
            {saving ? "Saving..." : `Save as ${zoneName} template`}
          </button>
        </div>
      )}
    </div>
  );
}
