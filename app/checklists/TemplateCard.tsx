"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ChecklistItemsEditor from "@/components/ChecklistItemsEditor";

export default function TemplateCard({
  templateId,
  roomType,
  items,
}: {
  templateId: string;
  roomType: string;
  items: { id: string; label: string; sort_order: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAdd(label: string) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("checklist_template_items").insert({
      template_id: templateId,
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
    const { error } = await supabase.from("checklist_template_items").update({ label }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("checklist_template_items").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  async function handleDeleteTemplate() {
    if (!confirm(`Delete the "${roomType}" template? Zones already using it are unaffected.`)) {
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("checklist_templates").delete().eq("id", templateId);
    router.refresh();
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-left font-medium"
        >
          {roomType} <span className="text-xs text-gray-400">({items.length} items)</span>
        </button>
        <button
          type="button"
          onClick={handleDeleteTemplate}
          disabled={deleting}
          className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
        >
          Delete template
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <ChecklistItemsEditor
            items={items}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            disabled={deleting}
          />
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
