import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

// Public route — cleaners hit this with no auth. Uses the service role client
// (server-only key) since there's no logged-in user to satisfy RLS policies.
// Validation here (zone/session actually exist and match) is what keeps this safe
// instead of relying on row-level security.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const setId = formData.get("setId") as string | null;
  const zoneSlug = formData.get("zoneSlug") as string | null;
  const sessionId = formData.get("sessionId") as string | null;
  const cleanerId = formData.get("cleanerId") as string | null;
  const photo = formData.get("photo") as File | null;

  if (!setId || !zoneSlug || !sessionId) {
    return NextResponse.json({ error: "Missing setId, zoneSlug, or sessionId" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: zoneDef } = await supabase
    .from("qr_set_zones")
    .select("zone_label")
    .eq("set_id", setId)
    .eq("zone_slug", zoneSlug)
    .maybeSingle();

  const { data: claim } = await supabase
    .from("property_set_claims")
    .select("property_id, properties ( name, hosts ( email ) )")
    .eq("set_id", setId)
    .is("released_at", null)
    .maybeSingle();

  const { data: session } = await supabase
    .from("turnover_sessions")
    .select("id, property_id, status")
    .eq("id", sessionId)
    .single();

  if (!zoneDef || !claim || !session || session.property_id !== claim.property_id) {
    return NextResponse.json({ error: "Zone/session mismatch" }, { status: 400 });
  }
  if (session.status !== "in_progress") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  const propertyId = claim.property_id;

  const { data: zoneSettings } = await supabase
    .from("property_zone_settings")
    .select("require_photo")
    .eq("property_id", propertyId)
    .eq("zone_slug", zoneSlug)
    .maybeSingle();

  if (zoneSettings?.require_photo && (!photo || photo.size === 0)) {
    return NextResponse.json(
      { error: "This zone requires a photo before it can be marked done" },
      { status: 400 }
    );
  }

  const { data: checklistItems, error: checklistItemsError } = await supabase
    .from("zone_checklist_items")
    .select("id")
    .eq("property_id", propertyId)
    .eq("zone_slug", zoneSlug);

  if (checklistItemsError) {
    return NextResponse.json({ error: checklistItemsError.message }, { status: 500 });
  }

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
    const path = `${sessionId}/${zoneSlug}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("scan-photos")
      .upload(path, photo, { contentType: photo.type });

    if (!uploadError) {
      const { data: publicUrl } = supabase.storage.from("scan-photos").getPublicUrl(path);
      photoUrl = publicUrl.publicUrl;
    }
  }

  // Upsert so re-scanning the same zone just updates the timestamp/photo instead of erroring
  const { error } = await supabase.from("scan_events").upsert(
    {
      session_id: sessionId,
      property_id: propertyId,
      zone_slug: zoneSlug,
      cleaner_id: cleanerId || null,
      scanned_at: new Date().toISOString(),
      photo_url: photoUrl,
    },
    { onConflict: "session_id,zone_slug" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort per-zone notification — never blocks the cleaner's flow if it fails.
  const property = claim.properties as unknown as { name: string; hosts: { email: string } };
  if (property?.hosts?.email) {
    sendEmail({
      to: property.hosts.email,
      subject: `${zoneDef.zone_label} marked done at ${property.name}`,
      text: `${zoneDef.zone_label} was just scanned as done at ${property.name}.`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
