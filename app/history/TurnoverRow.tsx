"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LocalTime from "@/app/properties/[id]/LocalTime";

type ChecklistItem = { id: string; label: string };
type Zone = { slug: string; name: string; zone_checklist_items: ChecklistItem[] };
type ScanRecord = {
  zone_slug: string;
  scanned_at: string;
  scan_event_photos: { photo_url: string; is_duplicate: boolean }[];
  cleaners: { name: string } | null;
};

export default function TurnoverRow({
  sessionId,
  propertyId,
  propertyName,
  cleanerName,
  startedAt,
  durationLabel,
  score,
  zones,
  scanRecords,
  completedItemIds,
}: {
  sessionId: string;
  propertyId: string;
  propertyName: string;
  cleanerName: string | null;
  startedAt: string;
  durationLabel: string | null;
  score: number | null;
  zones: Zone[];
  scanRecords: ScanRecord[];
  completedItemIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const scanByZone = new Map(scanRecords.map((r) => [r.zone_slug, r]));

  async function handleDelete() {
    if (
      !confirm(
        `Delete this turnover for "${propertyName}"? This removes its scan records and photos — this can't be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("turnover_sessions").delete().eq("id", sessionId);
    setDeleting(false);
    router.refresh();
  }

  return (
    <div className="border border-gray-800 rounded-xl text-sm bg-gray-950 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group w-full text-left px-5 py-4 hover:bg-gray-900"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" />{propertyName}</p>
            <p className="text-muted text-xs mt-1">
              <LocalTime
                iso={startedAt}
                options={{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }}
              />
              {" · "}
              {cleanerName ?? "No cleaner recorded"}
              {durationLabel ? ` · ${durationLabel}` : ""}
            </p>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full shrink-0 ${
              score === null
                ? "bg-gray-800 text-gray-300"
                : score >= 90
                  ? "bg-green-950 text-green-300"
                  : score >= 60
                    ? "bg-amber-950 text-amber-300"
                    : "bg-red-950 text-red-300"
            }`}
          >
            {score !== null ? `${score}% checklist completion` : "Complete"}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-4 bg-gray-950">
          {zones.map((zone) => {
            const scan = scanByZone.get(zone.slug);
            return (
              <div key={zone.slug}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-xs">{zone.name}</p>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                      scan ? "bg-green-950 text-green-300" : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {scan ? (
                      <>
                        Done at <LocalTime iso={scan.scanned_at} />
                        {scan.cleaners?.name ? ` by ${scan.cleaners.name}` : ""}
                      </>
                    ) : (
                      "Not scanned"
                    )}
                  </span>
                </div>
                {zone.zone_checklist_items.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {zone.zone_checklist_items.map((item) => (
                      <li key={item.id} className="text-xs text-muted flex items-center gap-1.5">
                        <span>{completedItemIds.has(item.id) ? "✓" : "○"}</span>
                        {item.label}
                      </li>
                    ))}
                  </ul>
                )}
                {scan && scan.scan_event_photos.length > 0 && (
                  <div className="flex gap-1.5 mt-1.5 flex-nowrap overflow-x-auto">
                    {scan.scan_event_photos.map((p, i) => (
                      <a
                        key={i}
                        href={p.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative shrink-0"
                        title={p.is_duplicate ? "Matches a photo uploaded before — possible reused photo" : undefined}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.photo_url}
                          alt={`${zone.name} photo ${i + 1}`}
                          className="w-16 h-16 rounded-lg object-cover border border-gray-700"
                        />
                        {p.is_duplicate && (
                          <span className="absolute -bottom-1 -right-1 bg-black/90 text-amber-300 text-[8px] font-medium leading-none rounded-full px-1 py-0.5">
                            reused
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 pt-1">
            <Link href={`/properties/${propertyId}`} className="text-sm text-green-400 hover:text-green-300">
              Open property page
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label={`Delete turnover for ${propertyName}`}
              className="text-sm font-medium text-red-400 border border-red-900 rounded-lg px-3 py-1.5 hover:bg-red-950 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
