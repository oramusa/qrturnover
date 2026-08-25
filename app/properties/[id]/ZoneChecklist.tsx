"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ChecklistItemsEditor from "@/components/ChecklistItemsEditor";

export default function ZoneChecklist({
  propertyId,
  zoneSlug,
  zoneName,
  items,
}: {
  propertyId: string;
  zoneSlug: string;
  zoneName: string;
  items: { id: string; label: string; sort_order: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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

  async function handleSaveAsTemplate() {
    setError(null);
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

    const trimmedZoneName = zoneName.trim();
    const { data: existingTemplates } = await supabase
      .from("checklist_templates")
      .select("id, room_type")
      .eq("host_id", user!.id);

    const existingMatch = existingTemplates?.find(
      (t) => t.room_type.toLowerCase() === trimmedZoneName.toLowerCase()
    );
    const roomType = existingMatch ? existingMatch.room_type : trimmedZoneName;

    const { data: template, error: upsertError } = await supabase
      .from("checklist_templates")
      .upsert(
        { host_id: user!.id, room_type: roomType },
        { onConflict: "host_id,room_type" }
      )
      .select("id")
      .single();

    if (upsertError) {
      setError(upsertError.message);
      setSaving(false);
      return;
    }

    if (template) {
      const { error: deleteError } = await supabase
        .from("checklist_template_items")
        .delete()
        .eq("template_id", template.id);
      if (deleteError) {
        setError(deleteError.message);
        setSaving(false);
        return;
      }
      const { error: insertError } = await supabase.from("checklist_template_items").insert(
        items.map((item, i) => ({
          template_id: template.id,
          label: item.label,
          sort_order: i,
        }))
      );
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-muted underline"
      >
        Checklist ({items.length})
      </button>
      {open && (
        <div className="mt-2 border rounded-lg p-3 bg-gray-50 text-gray-900">
          <ChecklistItemsEditor
            items={items}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            disabled={saving}
          />
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            disabled={saving}
            className="text-xs text-gray-500 hover:text-gray-900 mt-3 disabled:opacity-50"
          >
            {saving ? "Saving..." : `Save as ${zoneName} template`}
          </button>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
