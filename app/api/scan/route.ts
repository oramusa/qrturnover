import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

// Public route — cleaners hit this with no auth. Uses the service role client
// (server-only key) since there's no logged-in user to satisfy RLS policies.
// Validation here (zone/session actually exist and match) is what keeps this safe
// instead of relying on row-level security.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const zoneId = formData.get("zoneId") as string | null;
  const sessionId = formData.get("sessionId") as string | null;
  const cleanerId = formData.get("cleanerId") as string | null;
  const photo = formData.get("photo") as File | null;

  if (!zoneId || !sessionId) {
    return NextResponse.json({ error: "Missing zoneId or sessionId" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Confirm the session is real, still in progress, and actually belongs to this zone's property
  const { data: zone } = await supabase
    .from("zones")
    .select("id, name, require_photo, property_id, properties ( name, hosts ( email ) )")
    .eq("id", zoneId)
    .single();

  const { data: session } = await supabase
    .from("turnover_sessions")
    .select("id, property_id, status")
    .eq("id", sessionId)
    .single();

  if (!zone || !session || session.property_id !== zone.property_id) {
    return NextResponse.json({ error: "Zone/session mismatch" }, { status: 400 });
  }
  if (session.status !== "in_progress") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  if (zone.require_photo && (!photo || photo.size === 0)) {
    return NextResponse.json(
      { error: "This zone requires a photo before it can be marked done" },
      { status: 400 }
    );
  }

  const { data: checklistItems } = await supabase
    .from("zone_checklist_items")
    .select("id")
    .eq("zone_id", zoneId);

  if (checklistItems && checklistItems.length > 0) {
    const { data: completions } = await supabase
      .from("scan_item_completions")
      .select("item_id")
      .eq("session_id", sessionId)
      .in("item_id", checklistItems.map((i) => i.id));

    const remaining = checklistItems.length - (completions?.length ?? 0);
    if (remaining > 0) {
      return NextResponse.json(
        { error: `${remaining} checklist item${remaining === 1 ? "" : "s"} still need${remaining === 1 ? "s" : ""} to be checked off` },
        { status: 400 }
      );
    }
  }

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    const ext = photo.name.split(".").pop() || "jpg";
    const path = `${sessionId}/${zoneId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("scan-photos")
      .upload(path, photo, { contentType: photo.type });

    if (!uploadError) {
      const { data: publicUrl } = supabase.storage.from("scan-photos").getPublicUrl(path);
      photoUrl = publicUrl.publicUrl;
    }
  }

  // Upsert so re-scanning the same zone just updates the timestamp/photo instead of erroring
  const { error } = await supabase.from("scan_records").upsert(
    {
      session_id: sessionId,
      zone_id: zoneId,
      cleaner_id: cleanerId || null,
      scanned_at: new Date().toISOString(),
      photo_url: photoUrl,
    },
    { onConflict: "session_id,zone_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort per-zone notification — never blocks the cleaner's flow if it fails.
  const property = zone.properties as unknown as { name: string; hosts: { email: string } };
  if (property?.hosts?.email) {
    sendEmail({
      to: property.hosts.email,
      subject: `${zone.name} marked done at ${property.name}`,
      text: `${zone.name} was just scanned as done at ${property.name}.`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
