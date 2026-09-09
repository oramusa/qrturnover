import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NewPropertyForm from "./NewPropertyForm";
import AppNav from "@/app/components/AppNav";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: properties } = await supabase
    .from("properties")
    .select(
      `
      id, name, address,
      turnover_sessions ( id, status, started_at )
    `
    )
    .eq("host_id", user!.id)
    .order("created_at", { ascending: false });

  const propertyIds = (properties ?? []).map((p) => p.id);
  const { data: claims } =
    propertyIds.length > 0
      ? await supabase
          .from("property_set_claims")
          .select("property_id, set_id")
          .in("property_id", propertyIds)
          .is("released_at", null)
      : { data: [] as { property_id: string; set_id: string }[] };

  const setIdByProperty = new Map((claims ?? []).map((c) => [c.property_id, c.set_id]));
  const setIds = Array.from(new Set((claims ?? []).map((c) => c.set_id)));

  const { data: zoneRows } =
    setIds.length > 0
      ? await supabase.from("qr_set_zones").select("set_id").in("set_id", setIds)
      : { data: [] as { set_id: string }[] };

  const zoneCountBySet = new Map<string, number>();
  for (const row of zoneRows ?? []) {
    zoneCountBySet.set(row.set_id, (zoneCountBySet.get(row.set_id) ?? 0) + 1);
  }

  const activeSessions = (properties ?? []).flatMap((property) =>
    (property.turnover_sessions ?? [])
      .filter((session) => session.status === "in_progress")
      .map((session) => ({ ...session, propertyId: property.id }))
  );
  const activeSessionIds = activeSessions.map((session) => session.id);
  const { data: activeScans } = activeSessionIds.length
    ? await supabase
        .from("scan_events")
        .select("session_id, zone_slug")
        .in("session_id", activeSessionIds)
    : { data: [] as { session_id: string; zone_slug: string }[] };

  const scannedCountBySession = new Map<string, number>();
  for (const scan of activeScans ?? []) {
    scannedCountBySession.set(
      scan.session_id,
      (scannedCountBySession.get(scan.session_id) ?? 0) + 1
    );
  }

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const { count: completedThisMonth } = propertyIds.length
    ? await supabase
        .from("turnover_sessions")
        .select("id", { count: "exact", head: true })
        .in("property_id", propertyIds)
        .eq("status", "complete")
        .gte("completed_at", startOfMonth.toISOString())
    : { count: 0 };

  return (
    <div>
      <AppNav current="/dashboard" />
      <div className="max-w-5xl mx-auto p-6 sm:py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">Your properties</h1>
            <p className="text-sm text-muted mt-1">Monitor every turnover from one place.</p>
          </div>
          <NewPropertyForm />
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-7">
          <div className="border rounded-xl p-4">
            <p className="text-xs text-muted">Properties</p>
            <p className="text-2xl font-semibold mt-1">{properties?.length ?? 0}</p>
          </div>
          <div className="border rounded-xl p-4">
            <p className="text-xs text-muted">Turnovers in progress</p>
            <p className="text-2xl font-semibold mt-1">{activeSessions.length}</p>
          </div>
          <div className="border rounded-xl p-4">
            <p className="text-xs text-muted">Completed this month</p>
            <p className="text-2xl font-semibold mt-1">{completedThisMonth ?? 0}</p>
          </div>
        </div>

        <h2 className="text-lg font-medium mt-9">Property status</h2>

        <div className="grid md:grid-cols-2 gap-4 mt-3">
          {properties?.length === 0 && (
            <p className="text-muted">
              No properties yet — add your first one above to generate its QR zone codes.
            </p>
          )}

          {properties?.map((property) => {
            const propertySetId = setIdByProperty.get(property.id);
            const zoneCount = propertySetId ? zoneCountBySet.get(propertySetId) ?? 0 : 0;
            const activeSession = property.turnover_sessions?.find(
              (s) => s.status === "in_progress"
            );
            const scannedCount = activeSession
              ? scannedCountBySession.get(activeSession.id) ?? 0
              : zoneCount;
            const progress = zoneCount > 0 ? Math.min(100, Math.round((scannedCount / zoneCount) * 100)) : 0;

            return (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="group border rounded-xl p-5 hover:bg-gray-50 hover:text-gray-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium break-words">{property.name}</h3>
                    <p className="text-xs text-muted group-hover:text-gray-500 mt-1 break-words">
                      {zoneCount} zone{zoneCount === 1 ? "" : "s"}
                      {property.address ? ` · ${property.address}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                      activeSession
                        ? "bg-amber-100 text-amber-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {activeSession ? "Turnover in progress" : "Ready"}
                  </span>
                </div>

                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-5">
                  <div
                    className="h-full bg-green-600 rounded-full"
                    style={{ width: `${progress}%` }}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 mt-3 text-xs">
                  <span className="text-muted group-hover:text-gray-500">
                    {activeSession
                      ? `${scannedCount} of ${zoneCount} zones verified`
                      : zoneCount > 0
                        ? "Ready for the next turnover"
                        : "Add zones to finish setup"}
                  </span>
                  <span className="font-medium text-green-700">
                    {activeSession ? "View live →" : "Open →"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
