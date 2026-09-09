import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import StartTurnoverButton from "./StartTurnoverButton";
import CleanerAssignment from "./CleanerAssignment";
import AutoRefresh from "./AutoRefresh";
import DeletePropertyButton from "./DeletePropertyButton";
import ZoneCard from "./ZoneCard";
import AddZoneForm from "./AddZoneForm";
import AppNav from "@/app/components/AppNav";
import { getHostSetNumber } from "@/lib/setLabel";

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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, address")
    .eq("slug", slug)
    .single();

  if (!property) {
    return <div className="p-6">Property not found.</div>;
  }
  const id = property.id;

  const { data: claim } = await supabase
    .from("property_set_claims")
    .select("set_id")
    .eq("property_id", id)
    .is("released_at", null)
    .maybeSingle();

  const setId = claim?.set_id ?? null;
  const hostSetNumber = setId ? await getHostSetNumber(supabase, user!.id, setId) : null;

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

  const zones = (setZones ?? []).map((z) => ({
    slug: z.zone_slug,
    name: z.zone_label,
    task_description: settingsBySlug.get(z.zone_slug)?.task_description ?? null,
    require_photo: settingsBySlug.get(z.zone_slug)?.require_photo ?? false,
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
       scan_events ( zone_slug, scanned_at, cleaners ( name ), scan_event_photos ( photo_url, is_duplicate ) )`
    )
    .eq("property_id", id)
    .order("started_at", { ascending: false })
    .limit(6);

  const activeSession = sessions?.find((s) => s.status === "in_progress");
  const history = sessions?.filter((s) => s.status !== "in_progress") ?? [];
  const scannedZoneSlugs = new Set(
    activeSession?.scan_events?.map((r) => r.zone_slug) ?? []
  );
  const activePhotosByZone = new Map(
    (activeSession?.scan_events ?? []).map((r) => [
      r.zone_slug,
      (r.scan_event_photos ?? []).map((p) => ({ url: p.photo_url, isDuplicate: p.is_duplicate })),
    ])
  );
  const activeScannedAtByZone = new Map(
    (activeSession?.scan_events ?? []).map((r) => [r.zone_slug, r.scanned_at as string])
  );
  const activeCleanerByZone = new Map(
    (activeSession?.scan_events ?? [])
      .filter((r) => r.cleaners)
      .map((r) => [r.zone_slug, (r.cleaners as unknown as { name: string }).name])
  );
  const activeCleanerName = activeSession?.cleaners
    ? (activeSession.cleaners as unknown as { name: string }).name
    : null;

  return (
    <div>
      <AppNav current="/dashboard" />
      <div className="max-w-5xl mx-auto p-6 sm:py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-500 mb-2">
              {zones.length}-zone rental property
            </p>
            <h1 className="text-3xl font-semibold break-words">{property.name}</h1>
            {property.address && (
              <p className="text-sm text-muted mt-2">{property.address}</p>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href={`/properties/${slug}/print`}
              className="text-sm border border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-900"
            >
              Print QR sheet
            </Link>
            <DeletePropertyButton propertyId={id} propertyName={property.name} />
          </div>
        </div>

        <AutoRefresh enabled={!!activeSession} sessionId={activeSession?.id} />

        <div className="grid sm:grid-cols-3 gap-3 mt-7">
          <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
            <p className="text-xs text-muted">Current status</p>
            <p
              className={`text-lg font-semibold mt-1 ${
                activeSession ? "text-amber-400" : "text-green-400"
              }`}
            >
              {activeSession ? "Turnover in progress" : "Ready"}
            </p>
          </div>
          <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
            <p className="text-xs text-muted">Zones verified</p>
            <p className="text-2xl font-semibold mt-1">
              {scannedZoneSlugs.size}
              <span className="text-muted text-base font-normal"> / {zones.length}</span>
            </p>
          </div>
          <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
            <p className="text-xs text-muted">Assigned cleaners</p>
            <p className="text-2xl font-semibold mt-1">{assignedIds.size}</p>
          </div>
        </div>

        <StartTurnoverButton
          propertyId={id}
          hasActiveSession={!!activeSession}
          activeSessionId={activeSession?.id}
          cleanerName={activeCleanerName}
          zoneCount={zones.length}
          scannedCount={scannedZoneSlugs.size}
        />

        <div className="flex items-center justify-between gap-4 mt-9 flex-wrap">
          <div>
            <h2 className="text-lg font-medium">Property zones</h2>
            <p className="text-xs text-muted mt-1">Live QR verification and photo proof for each room.</p>
          </div>
          {setId && (
            <div className="flex items-center gap-3">
              <AddZoneForm
                propertyId={id}
                setId={setId}
                existingSlugs={zones.map((z) => z.slug)}
                nextSortOrder={zones.length}
              />
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 whitespace-nowrap">
                QR Set {hostSetNumber ? `#${hostSetNumber}` : setId}
              </span>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          {zones.map((zone) => (
            <ZoneCard
              key={zone.slug}
              propertyId={id}
              zone={zone}
              showStatus={!!activeSession}
              done={!!activeSession && scannedZoneSlugs.has(zone.slug)}
              scannedAt={activeScannedAtByZone.get(zone.slug)}
              scannedBy={activeCleanerByZone.get(zone.slug)}
              photos={activePhotosByZone.get(zone.slug) ?? []}
            />
          ))}
          {zones.length === 0 && (
            <p className="text-muted text-sm">
              {setId
                ? "This QR set has no zones defined."
                : "No QR set claimed for this property yet."}
            </p>
          )}
        </div>

        <div className="border-t border-gray-800 mt-9 pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Assigned cleaners</h2>
            <Link href="/cleaners" className="text-xs text-green-400 hover:text-green-300">
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
          <div className="border-t border-gray-800 mt-9 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Turnover history</h2>
              <Link href={`/history?property=${id}`} className="text-xs text-green-400 hover:text-green-300">
                View full history
              </Link>
            </div>
            <div className="space-y-3">
              {history.map((s) => {
                const duration = formatDuration(s.job_started_at, s.job_finished_at);
                const cleanerName = (s.cleaners as unknown as { name: string } | null)?.name;
                const photos = (s.scan_events ?? []).flatMap((r) =>
                  (r.scan_event_photos ?? []).map((p) => ({
                    zoneSlug: r.zone_slug,
                    url: p.photo_url,
                    isDuplicate: p.is_duplicate,
                  }))
                );
                return (
                  <div key={s.id} className="border border-gray-800 rounded-xl px-4 py-3 text-sm bg-gray-950">
                    <div className="flex items-center justify-between">
                      <div>
                        <p>{new Date(s.started_at).toLocaleDateString()}</p>
                        <p className="text-muted text-xs">
                          {cleanerName ?? "No cleaner recorded"}
                          {duration ? ` · ${duration}` : ""}
                        </p>
                      </div>
                      <span className="text-xs bg-green-950 text-green-300 px-2.5 py-1 rounded-full whitespace-nowrap">
                        Complete
                      </span>
                    </div>
                    {photos.length > 0 && (
                      <div className="flex gap-2 mt-3 flex-nowrap overflow-x-auto">
                        {photos.map((p, i) => (
                          <a
                            key={i}
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block shrink-0"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.url}
                              alt={`${zoneLabelBySlug.get(p.zoneSlug) ?? p.zoneSlug} photo`}
                              title={
                                p.isDuplicate
                                  ? "Matches a photo uploaded before — possible reused photo"
                                  : (zoneLabelBySlug.get(p.zoneSlug) ?? p.zoneSlug)
                              }
                              className="w-14 h-14 rounded object-cover border border-gray-700"
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
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
