import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Public route — cleaners have no login session, only a cleanerId stored in the
// browser's localStorage (cookies proved unreliable on some mobile browsers, see
// ScanClient.tsx). This lets the client fetch zone/turnover state without ever
// touching the service role key directly.
export async function GET(req: NextRequest) {
  const zoneId = req.nextUrl.searchParams.get("zoneId");
  const cleanerId = req.nextUrl.searchParams.get("cleanerId");

  if (!zoneId) {
    return NextResponse.json({ error: "Missing zoneId" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: zone } = await supabase
    .from("zones")
    .select(
      "id, name, task_description, require_photo, property_id, properties ( name, host_id )"
    )
    .eq("id", zoneId)
    .single();

  if (!zone) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  const hostId = (zone.properties as unknown as { host_id: string })?.host_id;
  const propertyName = (zone.properties as unknown as { name: string })?.name;

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

  const { data: activeSession } = await supabase
    .from("turnover_sessions")
    .select("id, job_started_at, job_finished_at")
    .eq("property_id", zone.property_id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: checklistItems } = await supabase
    .from("zone_checklist_items")
    .select("id, label, sort_order")
    .eq("zone_id", zoneId)
    .order("sort_order", { ascending: true });

  let completedIds = new Set<string>();
  if (activeSession) {
    const { data: completions } = await supabase
      .from("scan_item_completions")
      .select("item_id")
      .eq("session_id", activeSession.id);
    completedIds = new Set((completions ?? []).map((c) => c.item_id));
  }

  const checklist = (checklistItems ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    completed: completedIds.has(item.id),
  }));

  return NextResponse.json({
    zone: {
      id: zone.id,
      name: zone.name,
      task_description: zone.task_description,
      checklist,
      require_photo: zone.require_photo,
      property_name: propertyName,
    },
    // null cleanerName with a non-null cleanerId means the stored id is stale/invalid
    // (e.g. from a different host's zone) — treat it as logged out.
    cleaner: cleanerId && cleanerName ? { id: cleanerId, name: cleanerName } : null,
    activeSession: activeSession ?? null,
  });
}
