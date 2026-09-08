"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ZoneSettings({
  propertyId,
  zoneSlug,
  taskDescription,
  requirePhoto,
}: {
  propertyId: string;
  zoneSlug: string;
  taskDescription: string | null;
  requirePhoto: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(taskDescription ?? "");
  const [require, setRequire] = useState(requirePhoto);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const { error } = await supabase.from("property_zone_settings").upsert(
      {
        property_id: propertyId,
        zone_slug: zoneSlug,
        task_description: description.trim() || null,
        require_photo: require,
      },
      { onConflict: "property_id,zone_slug" }
    );
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-muted underline"
      >
        Zone settings
      </button>
      {open && (
        <div className="mt-2 border rounded-lg p-3 bg-gray-50 text-gray-900 space-y-2">
          <label className="block">
            <span className="text-xs text-gray-500">Task description</span>
            <input
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setSaved(false);
              }}
              placeholder="e.g. change sheets, restock towels"
              disabled={saving}
              className="block w-full text-sm mt-1 border rounded px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={require}
              onChange={(e) => {
                setRequire(e.target.checked);
                setSaved(false);
              }}
              disabled={saving}
            />
            Require photo before this zone can be marked done
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-black text-white rounded px-3 py-1.5 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {saved && <span className="text-xs text-green-700">Saved!</span>}
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
      )}
    </div>
  );
}
