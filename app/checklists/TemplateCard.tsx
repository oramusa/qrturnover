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
  const [applying, setApplying] = useState(false);
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

  async function handleApplyToExisting() {
    setError(null);
    if (items.length === 0) {
      alert("Add at least one item to this template before applying it.");
      return;
    }
    if (
      !confirm(
        `Apply "${roomType}" to every existing zone named "${roomType}"? This replaces that zone's current checklist items with this template's ${items.length} item${items.length === 1 ? "" : "s"} — any custom items already there will be removed.`
      )
    ) {
      return;
    }

    setApplying(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("host_id", user!.id);
    const propertyIds = (properties ?? []).map((p) => p.id);

    const { data: claims } = propertyIds.length
      ? await supabase
          .from("property_set_claims")
          .select("property_id, set_id")
          .in("property_id", propertyIds)
          .is("released_at", null)
      : { data: [] as { property_id: string; set_id: string }[] };

    const setIds = Array.from(new Set((claims ?? []).map((c) => c.set_id)));
    const propertyIdBySetId = new Map((claims ?? []).map((c) => [c.set_id, c.property_id]));

    const { data: zones } = setIds.length
      ? await supabase
          .from("qr_set_zones")
          .select("set_id, zone_slug, zone_label")
          .in("set_id", setIds)
      : { data: [] as { set_id: string; zone_slug: string; zone_label: string }[] };

    const matches = (zones ?? [])
      .filter((z) => z.zone_label.toLowerCase() === roomType.toLowerCase())
      .map((z) => ({ propertyId: propertyIdBySetId.get(z.set_id)!, zoneSlug: z.zone_slug }));

    for (const { propertyId, zoneSlug } of matches) {
      await supabase
        .from("zone_checklist_items")
        .delete()
        .eq("property_id", propertyId)
        .eq("zone_slug", zoneSlug);

      await supabase.from("zone_checklist_items").insert(
        items.map((item) => ({
          property_id: propertyId,
          zone_slug: zoneSlug,
          label: item.label,
          sort_order: item.sort_order,
        }))
      );
    }

    setApplying(false);
    alert(
      matches.length === 0
        ? `No existing zones named "${roomType}" were found.`
        : `Applied to ${matches.length} zone${matches.length === 1 ? "" : "s"}.`
    );
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
    <div className="border border-gray-800 rounded-xl p-5 bg-gray-950">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-left font-medium flex items-center gap-3"
        >
          <span className="w-9 h-9 rounded-lg bg-green-950 text-green-300 flex items-center justify-center" aria-hidden="true">✓</span>
          <span>{roomType}<span className="block text-xs text-muted font-normal mt-0.5">{items.length} item{items.length === 1 ? "" : "s"}</span></span>
        </button>
        <button
          type="button"
          onClick={handleDeleteTemplate}
          disabled={deleting}
          className="text-xs text-gray-500 hover:text-red-400 disabled:opacity-50"
        >
          Delete template
        </button>
      </div>
      {open && (
        <div className="mt-4 border-t border-gray-800 pt-4">
          <ChecklistItemsEditor
            items={items}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            disabled={deleting}
          />
          <button
            type="button"
            onClick={handleApplyToExisting}
            disabled={applying || deleting}
            className="text-xs text-gray-500 hover:text-gray-900 mt-3 disabled:opacity-50"
          >
            {applying ? "Applying..." : "Apply to existing properties"}
          </button>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
