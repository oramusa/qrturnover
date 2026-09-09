"use client";

import { useState } from "react";
import LocalTime from "./LocalTime";
import ZoneChecklist from "./ZoneChecklist";
import ZoneSettings from "./ZoneSettings";

type ChecklistItem = { id: string; label: string; sort_order: number };
type Photo = { url: string; isDuplicate: boolean };

export default function ZoneCard({
  propertyId,
  zone,
  showStatus,
  done,
  scannedAt,
  scannedBy,
  completedItemIds,
  photos,
}: {
  propertyId: string;
  zone: {
    slug: string;
    name: string;
    task_description: string | null;
    require_photo: boolean;
    zone_checklist_items: ChecklistItem[];
  };
  showStatus: boolean;
  done: boolean;
  scannedAt?: string;
  scannedBy?: string;
  completedItemIds: Set<string>;
  photos: Photo[];
}) {
  const [open, setOpen] = useState(false);
  const total = zone.zone_checklist_items.length;
  const completedCount = zone.zone_checklist_items.filter((i) => completedItemIds.has(i.id)).length;

  return (
    <div className="border border-gray-800 rounded-xl p-5 bg-gray-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium break-words flex items-center gap-2">
            {zone.name}
            {zone.require_photo && (
              <span className="text-[10px] text-muted border border-gray-700 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                photo required
              </span>
            )}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {showStatus
              ? done
                ? `Scanned by ${scannedBy ?? "cleaner"}`
                : "Waiting for QR scan"
              : (zone.task_description ?? "No task notes yet")}
          </p>
        </div>
        {showStatus && (
          <span
            className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${
              done ? "bg-green-950 text-green-300" : "bg-gray-800 text-gray-400"
            }`}
          >
            {done && scannedAt ? (
              <>
                Done at <LocalTime iso={scannedAt} />
              </>
            ) : done ? (
              "Done"
            ) : (
              "Pending"
            )}
          </span>
        )}
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 mt-3 flex-nowrap overflow-x-auto">
          {photos.map((p, i) => (
            <a
              key={i}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative shrink-0"
              title={p.isDuplicate ? "Matches a photo uploaded before — possible reused photo" : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`${zone.name} photo ${i + 1}`}
                className="w-10 h-10 rounded object-cover border border-gray-700"
              />
              {p.isDuplicate && (
                <span className="absolute -bottom-1 -right-1 bg-black/90 text-amber-300 text-[8px] font-medium leading-none rounded-full px-1 py-0.5">
                  reused
                </span>
              )}
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-800">
        <span className="text-xs text-muted">
          {total > 0 ? `${completedCount} / ${total} checklist items` : "No checklist items"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs font-medium text-green-400 hover:text-green-300"
        >
          {open ? "Hide details ↑" : "Open details →"}
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-gray-800 space-y-4">
          <ZoneChecklist
            propertyId={propertyId}
            zoneSlug={zone.slug}
            items={zone.zone_checklist_items}
            forceOpen
          />
          <ZoneSettings
            propertyId={propertyId}
            zoneSlug={zone.slug}
            taskDescription={zone.task_description}
            requirePhoto={zone.require_photo}
            forceOpen
          />
        </div>
      )}
    </div>
  );
}
