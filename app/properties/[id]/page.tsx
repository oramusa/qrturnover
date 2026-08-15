import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ZoneManager from "./ZoneManager";
import StartTurnoverButton from "./StartTurnoverButton";
import CleanerAssignment from "./CleanerAssignment";
import AutoRefresh from "./AutoRefresh";
import DeleteZoneButton from "./DeleteZoneButton";
import DeletePropertyButton from "./DeletePropertyButton";
import ZoneChecklist from "./ZoneChecklist";

function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) return null;
  const minutes = Math.round(
    (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000
  );
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, address")
    .eq("id", id)
    .single();

  const { data: zones } = await supabase
    .from("zones")
    .select(
      "id, name, task_description, checklist_items, require_photo, sort_order, zone_checklist_items ( id, label, sort_order )"
    )
    .eq("property_id", id)
    .order("sort_order", { ascending: true });

  // All cleaners on this host's roster, and which are assigned to this property
  const { data: allCleaners } = await supabase
    .from("cleaners")
    .select("id, name")
    .eq("host_id", user!.id);

  const { data: assignments } = await supabase
    .from("property_cleaners")
    .select("cleaner_id")
    .eq("property_id", id);

  const assignedIds = new Set(assignments?.map((a) => a.cleaner_id) ?? []);

  // Recent turnover sessions (active + history), with cleaner name + scan records
  const { data: sessions } = await supabase
    .from("turnover_sessions")
    .select(
      `id, status, started_at, completed_at, job_started_at, job_finished_at,
       cleaners ( name ),
       scan_records ( zone_id, scanned_at, photo_url, zones ( name ) )`
    )
    .eq("property_id", id)
    .order("started_at", { ascending: false })
    .limit(6);

  const activeSession = sessions?.find((s) => s.status === "in_progress");
  const history = sessions?.filter((s) => s.status !== "in_progress") ?? [];
  const scannedZoneIds = new Set(
    activeSession?.scan_records?.map((r) => r.zone_id) ?? []
  );
  const activePhotoByZone = new Map(
    (activeSession?.scan_records ?? [])
      .filter((r) => r.photo_url)
      .map((r) => [r.zone_id, r.photo_url as string])
  );

  if (!property) {
    return <div className="p-6">Property not found.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link href="/dashboard" className="text-sm text-gray-500 underline">
        &larr; All properties
      </Link>

      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{property.name}</h1>
          {property.address && (
            <p className="text-sm text-gray-500">{property.address}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/properties/${id}/print`}
            className="text-sm border rounded px-3 py-2 hover:bg-gray-50 hover:text-gray-900"
          >
            Print QR sheet
          </Link>
          <DeletePropertyButton propertyId={id} propertyName={property.name} />
        </div>
      </div>

      <AutoRefresh enabled={!!activeSession} />

      <StartTurnoverButton
        propertyId={id}
        hasActiveSession={!!activeSession}
        activeSessionId={activeSession?.id}
      />

      {activeSession && (
        <p className="text-sm text-gray-500 mt-2">
          {activeSession.cleaners
            ? `Assigned cleaner: ${(activeSession.cleaners as unknown as { name: string }).name}`
            : "Waiting for a cleaner to start the job"}
          {activeSession.job_started_at && !activeSession.job_finished_at && " — job in progress"}
        </p>
      )}

      <h2 className="text-lg font-medium mt-8 mb-3">Zones</h2>

      {activeSession && (
        <p className="text-sm text-gray-500 mb-3">
          Live status for the current turnover — updates as the cleaner scans each zone.
        </p>
      )}

      <div className="space-y-2 mb-6">
        {zones?.map((zone) => {
          const done = !!activeSession && scannedZoneIds.has(zone.id);
          const photoUrl = activePhotoByZone.get(zone.id);
          return (
            <div key={zone.id} className="border rounded-lg px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt={`${zone.name} photo`}
                      className="w-10 h-10 rounded object-cover border shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium flex items-center gap-2">
                      {zone.name}
                      {zone.require_photo && (
                        <span className="text-[10px] text-gray-400 border rounded-full px-1.5 py-0.5">
                          photo required
                        </span>
                      )}
                    </p>
                    {zone.task_description && (
                      <p className="text-xs text-gray-500">{zone.task_description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {activeSession && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        done ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {done ? "Done" : "Pending"}
                    </span>
                  )}
                  <DeleteZoneButton zoneId={zone.id} zoneName={zone.name} />
                </div>
              </div>
              <ZoneChecklist
                zoneId={zone.id}
                zoneName={zone.name}
                items={(zone.zone_checklist_items ?? [])
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((i) => ({ id: i.id, label: i.label }))}
              />
            </div>
          );
        })}
        {zones?.length === 0 && (
          <p className="text-gray-500 text-sm">No zones yet — add your first one below.</p>
        )}
      </div>

      <ZoneManager propertyId={id} />

      <div className="border-t mt-8 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Assigned cleaners</h2>
          <Link href="/cleaners" className="text-xs text-gray-500 underline">
            Manage cleaner roster
          </Link>
        </div>
        <CleanerAssignment
          propertyId={id}
          allCleaners={allCleaners ?? []}
          assignedIds={Array.from(assignedIds)}
        />
      </div>

      {history.length > 0 && (
        <div className="border-t mt-8 pt-6">
          <h2 className="text-lg font-medium mb-3">Turnover history</h2>
          <div className="space-y-2">
            {history.map((s) => {
              const duration = formatDuration(s.job_started_at, s.job_finished_at);
              const cleanerName = (s.cleaners as unknown as { name: string } | null)?.name;
              const photos = (s.scan_records ?? []).filter((r) => r.photo_url);
              return (
                <div key={s.id} className="border rounded-lg px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p>{new Date(s.started_at).toLocaleDateString()}</p>
                      <p className="text-gray-500 text-xs">
                        {cleanerName ?? "No cleaner recorded"}
                        {duration ? ` · ${duration}` : ""}
                      </p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Complete
                    </span>
                  </div>
                  {photos.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {photos.map((p, i) => (
                        <a
                          key={i}
                          href={p.photo_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.photo_url!}
                            alt={`${(p.zones as unknown as { name: string } | null)?.name ?? "Zone"} photo`}
                            title={(p.zones as unknown as { name: string } | null)?.name}
                            className="w-14 h-14 rounded object-cover border"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
