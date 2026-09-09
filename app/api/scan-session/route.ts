import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Public route — cleaners have no login session, only a cleanerId stored in the
// browser's localStorage (cookies proved unreliable on some mobile browsers, see
// ScanClient.tsx). This lets the client fetch zone/turnover state without ever
// touching the service role key directly.
//
// A QR code encodes {setId, zoneSlug} — stable regardless of which property has
// the physical sheet claimed. This route resolves that pair through the active
// property_set_claims row to find the actual property.
export async function GET(req: NextRequest) {
  const setId = req.nextUrl.searchParams.get("setId");
  const zoneSlug = req.nextUrl.searchParams.get("zoneSlug");
  const cleanerId = req.nextUrl.searchParams.get("cleanerId");

  if (!setId || !zoneSlug) {
    return NextResponse.json({ error: "Missing setId or zoneSlug" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: zoneDef } = await supabase
    .from("qr_set_zones")
    .select("zone_label")
    .eq("set_id", setId)
    .eq("zone_slug", zoneSlug)
    .maybeSingle();

  if (!zoneDef) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  const { data: claim } = await supabase
    .from("property_set_claims")
    .select("property_id, properties ( name, host_id )")
    .eq("set_id", setId)
    .is("released_at", null)
    .maybeSingle();

  if (!claim) {
    return NextResponse.json(
      { error: "This QR sheet isn't assigned to a property yet" },
      { status: 404 }
    );
  }

  const propertyId = claim.property_id;
  const hostId = (claim.properties as unknown as { host_id: string })?.host_id;
  const propertyName = (claim.properties as unknown as { name: string })?.name;

  let cleanerName: string | null = null;
  if (cleanerId) {
    const { data: cleaner } = await supabase
      .from("cleaners")
      .select("id, name")
      .eq("id", cleanerId)
      .eq("host_id", hostId)
      .maybeSingle();
    cleanerName = cleaner?.name ?? null;
  }

  const { data: zoneSettings } = await supabase
    .from("property_zone_settings")
    .select("task_description, require_photo")
    .eq("property_id", propertyId)
    .eq("zone_slug", zoneSlug)
    .maybeSingle();

  const { data: activeSession } = await supabase
    .from("turnover_sessions")
    .select("id, job_started_at, job_finished_at")
    .eq("property_id", propertyId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // No active session doesn't always mean "never started" — distinguish a
  // property that just finished its last turnover from one that's never had
  // one, so the cleaner's screen doesn't imply nothing happened yet.
  let lastTurnoverJustFinished = false;
  if (!activeSession) {
    const { data: lastSession } = await supabase
      .from("turnover_sessions")
      .select("status")
      .eq("property_id", propertyId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastTurnoverJustFinished = lastSession?.status === "complete";
  }

  const { data: setZones } = await supabase
    .from("qr_set_zones")
    .select("zone_slug, zone_label, sort_order")
    .eq("set_id", setId)
    .order("sort_order", { ascending: true });

  let doneZoneSlugs = new Set<string>();
  if (activeSession) {
    const { data: scans } = await supabase
      .from("scan_events")
      .select("zone_slug")
      .eq("session_id", activeSession.id);
    doneZoneSlugs = new Set((scans ?? []).map((s) => s.zone_slug));
  }

  const otherZones = (setZones ?? [])
    .filter((z) => z.zone_slug !== zoneSlug)
    .map((z) => ({
      slug: z.zone_slug,
      name: z.zone_label,
      done: doneZoneSlugs.has(z.zone_slug),
    }));

  return NextResponse.json({
    zone: {
      slug: zoneSlug,
      name: zoneDef.zone_label,
      task_description: zoneSettings?.task_description ?? null,
      require_photo: zoneSettings?.require_photo ?? false,
      property_name: propertyName,
    },
    // null cleanerName with a non-null cleanerId means the stored id is stale/invalid
    // (e.g. from a different host's zone) — treat it as logged out.
    cleaner: cleanerId && cleanerName ? { id: cleanerId, name: cleanerName } : null,
    activeSession: activeSession ?? null,
    lastTurnoverJustFinished,
    otherZones,
  });
}
