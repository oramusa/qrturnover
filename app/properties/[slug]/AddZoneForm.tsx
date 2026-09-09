"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function AddZoneForm({
  propertyId,
  setId,
  existingSlugs,
  nextSortOrder,
}: {
  propertyId: string;
  setId: string;
  existingSlugs: string[];
  nextSortOrder: number;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;

    const base = slugify(trimmed) || "zone";
    let slug = base;
    let n = 2;
    while (existingSlugs.includes(slug)) {
      slug = `${base}_${n}`;
      n++;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("qr_set_zones").insert({
      set_id: setId,
      zone_slug: slug,
      zone_label: trimmed,
      sort_order: nextSortOrder,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }

    fetch("/api/notify-new-zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, setId, zoneSlug: slug }),
    }).catch(() => {});

    setLabel("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-green-400 hover:text-green-300"
      >
        + Add zone
      </button>
    );
  }

  return (
    <form onSubmit={handleAdd} className="flex items-center gap-2">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Living Room 2"
        autoFocus
        disabled={saving}
        className="text-sm border rounded px-2 py-1 bg-white text-gray-900"
      />
      <button
        type="submit"
        disabled={saving || !label.trim()}
        className="text-xs bg-black text-white rounded px-3 py-1.5 disabled:opacity-50"
      >
        {saving ? "Adding..." : "Add"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
          setLabel("");
        }}
        disabled={saving}
        className="text-xs text-muted underline"
      >
        Cancel
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </form>
  );
}
