"use client";

import { useState } from "react";
import Link from "next/link";
import LocalTime from "@/app/properties/[id]/LocalTime";

type ChecklistItem = { id: string; label: string };
type Zone = { id: string; name: string; zone_checklist_items: ChecklistItem[] };
type ScanRecord = {
  zone_id: string;
  scanned_at: string;
  photo_url: string | null;
  cleaners: { name: string } | null;
};

export default function TurnoverRow({
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
  const scanByZone = new Map(scanRecords.map((r) => [r.zone_id, r]));

  return (
    <div className="border rounded-lg text-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 hover:text-gray-900"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{propertyName}</p>
            <p className="text-gray-500 text-xs mt-0.5">
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
                ? "bg-gray-100 text-gray-500"
                : score >= 90
                  ? "bg-green-100 text-green-800"
                  : score >= 60
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-800"
            }`}
          >
            {score !== null ? `${score}% clean score` : "Complete"}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {zones.map((zone) => {
            const scan = scanByZone.get(zone.id);
            return (
              <div key={zone.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-xs">{zone.name}</p>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                      scan ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
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
                      <li key={item.id} className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span>{completedItemIds.has(item.id) ? "✓" : "○"}</span>
                        {item.label}
                      </li>
                    ))}
                  </ul>
                )}
                {scan?.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={scan.photo_url}
                    alt={`${zone.name} photo`}
                    className="w-14 h-14 rounded object-cover border mt-1.5"
                  />
                )}
              </div>
            );
          })}
          <Link href={`/properties/${propertyId}`} className="text-xs text-gray-500 underline">
            Open property page
          </Link>
        </div>
      )}
    </div>
  );
}
