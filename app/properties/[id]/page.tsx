import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import StartTurnoverButton from "./StartTurnoverButton";
import CleanerAssignment from "./CleanerAssignment";
import AutoRefresh from "./AutoRefresh";
import DeletePropertyButton from "./DeletePropertyButton";
import ZoneChecklist from "./ZoneChecklist";
import LocalTime from "./LocalTime";
import AppNav from "@/app/components/AppNav";

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

  const { data: claim } = await supabase
    .from("property_set_claims")
    .select("set_id")
    .eq("property_id", id)
    .is("released_at", null)
    .maybeSingle();

  const setId = claim?.set_id ?? null;

  const { data: setZones } = setId
    ? await supabase
        .from("qr_set_zones")
        .select("zone_slug, zone_label, sort_order")
        .eq("set_id", setId)
        .order("sort_order", { ascending: true })
    : { data: [] as { zone_slug: string; zone_label: string; sort_order: number }[] };

  const { data: zoneSettingsRows } = await supabase
    .from("property_zone_settings")
    .select("zone_slug, task_description, require_photo")
    .eq("property_id", id);
  const settingsBySlug = new Map((zoneSettingsRows ?? []).map((s) => [s.zone_slug, s]));

  const { data: checklistItemRows } = await supabase
    .from("zone_checklist_items")
    .select("id, zone_slug, label, sort_order")
    .eq("property_id", id)
    .order("sort_order", { ascending: true });
  const checklistBySlug = new Map<string, { id: string; label: string; sort_order: number }[]>();
  for (const item of checklistItemRows ?? []) {
    const arr = checklistBySlug.get(item.zone_slug) ?? [];
    arr.push({ id: item.id, label: item.label, sort_order: item.sort_order });
    checklistBySlug.set(item.zone_slug, arr);
  }

  const zones = (setZones ?? []).map((z) => ({
    slug: z.zone_slug,
    name: z.zone_label,
    task_description: settingsBySlug.get(z.zone_slug)?.task_description ?? null,
    require_photo: settingsBySlug.get(z.zone_slug)?.require_photo ?? false,
    zone_checklist_items: checklistBySlug.get(z.zone_slug) ?? [],
  }));
  const zoneLabelBySlug = new Map(zones.map((z) => [z.slug, z.name]));

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

  // Recent turnover sessions (active + history), with cleaner name + scan events
  const { data: sessions } = await supabase
    .from("turnover_sessions")
    .select(
      `id, status, started_at, completed_at, job_started_at, job_finished_at,
       cleaners ( name ),
       scan_events ( zone_slug, scanned_at, photo_url, cleaners ( name ) )`
    )
    .eq("property_id", id)
    .order("started_at", { ascending: false })
    .limit(6);

  const activeSession = sessions?.find((s) => s.status === "in_progress");
  const history = sessions?.filter((s) => s.status !== "in_progress") ?? [];
  const scannedZoneSlugs = new Set(
    activeSession?.scan_events?.map((r) => r.zone_slug) ?? []
  );
  const activePhotoByZone = new Map(
    (activeSession?.scan_events ?? [])
      .filter((r) => r.photo_url)
      .map((r) => [r.zone_slug, r.photo_url as string])
  );
  const activeScannedAtByZone = new Map(
    (activeSession?.scan_events ?? []).map((r) => [r.zone_slug, r.scanned_at as string])
  );
  const activeCleanerByZone = new Map(
    (activeSession?.scan_events ?? [])
      .filter((r) => r.cleaners)
      .map((r) => [r.zone_slug, (r.cleaners as unknown as { name: string }).name])
  );

  const { data: itemCompletions } = activeSession
    ? await supabase
        .from("scan_item_completions")
        .select("item_id")
        .eq("session_id", activeSession.id)
    : { data: [] as { item_id: string }[] };
  const completedItemIds = new Set((itemCompletions ?? []).map((c) => c.item_id));

  if (!property) {
    return <div className="p-6">Property not found.</div>;
  }

  return (
    <>
      <AppNav />
      <div className="max-w-3xl mx-auto p-6">
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

      <AutoRefresh enabled={!!activeSession} sessionId={activeSession?.id} />

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

      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-lg font-medium">Zones</h2>
        {setId && <span className="text-xs text-gray-400">QR set: {setId}</span>}
      </div>

      {activeSession && (
        <p className="text-sm text-gray-500 mb-3">
          Live status for the current turnover — updates as the cleaner scans each zone.
        </p>
      )}

      <div className="space-y-2 mb-6">
        {zones.map((zone) => {
          const done = !!activeSession && scannedZoneSlugs.has(zone.slug);
          const photoUrl = activePhotoByZone.get(zone.slug);
          const scannedAt = activeScannedAtByZone.get(zone.slug);
          const scannedBy = activeCleanerByZone.get(zone.slug);
          return (
            <div key={zone.slug} className="border rounded-lg px-4 py-3">
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
                    {done && scannedBy && (
                      <p className="text-xs text-gray-400">Scanned by {scannedBy}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {activeSession && (
                    <>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          done ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
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
                      {zone.zone_checklist_items.length > 0 && (
                        <span className="text-xs text-gray-400">
                          {zone.zone_checklist_items.filter((i) => completedItemIds.has(i.id)).length}/
                          {zone.zone_checklist_items.length} items
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <ZoneChecklist
                propertyId={id}
                zoneSlug={zone.slug}
                zoneName={zone.name}
                items={zone.zone_checklist_items}
              />
            </div>
          );
        })}
        {zones.length === 0 && (
          <p className="text-gray-500 text-sm">
            {setId
              ? "This QR set has no zones defined."
              : "No QR set claimed for this property yet."}
          </p>
        )}
      </div>

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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Turnover history</h2>
            <Link href={`/history?property=${id}`} className="text-xs text-gray-500 underline">
              View full history
            </Link>
          </div>
          <div className="space-y-2">
            {history.map((s) => {
              const duration = formatDuration(s.job_started_at, s.job_finished_at);
              const cleanerName = (s.cleaners as unknown as { name: string } | null)?.name;
              const photos = (s.scan_events ?? []).filter((r) => r.photo_url);
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
                            alt={`${zoneLabelBySlug.get(p.zone_slug) ?? p.zone_slug} photo`}
                            title={zoneLabelBySlug.get(p.zone_slug) ?? p.zone_slug}
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
    </>
  );
}
