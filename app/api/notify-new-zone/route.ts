import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

// Fire-and-forget admin notification for a zone added after the property's
// initial creation (see /api/notify-new-property for the initial-batch case).
export async function POST(req: NextRequest) {
  const { propertyId, setId, zoneSlug } = await req.json();
  if (!propertyId || !setId || !zoneSlug) {
    return NextResponse.json({ error: "Missing propertyId, setId, or zoneSlug" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: property } = await supabase
    .from("properties")
    .select("name, hosts ( email, mailing_address )")
    .eq("id", propertyId)
    .single();

  const { data: zone } = await supabase
    .from("qr_set_zones")
    .select("zone_label")
    .eq("set_id", setId)
    .eq("zone_slug", zoneSlug)
    .single();

  if (!property || !zone) {
    return NextResponse.json({ error: "Property or zone not found" }, { status: 404 });
  }

  const host = property.hosts as unknown as { email: string; mailing_address: string | null };
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "oramusa@gmail.com";

  await sendEmail({
    to: adminEmail,
    subject: `New zone "${zone.zone_label}" added — ${property.name} (${setId})`,
    text: [
      `Host: ${host?.email ?? "unknown"}`,
      `Property: ${property.name}`,
      `QR set: ${setId}`,
      `New zone: ${zone.zone_label} (${zoneSlug})`,
      `Mailing address: ${host?.mailing_address?.trim() || "(not provided yet)"}`,
      "",
      `Download PNG: ${base}/api/qr/${setId}/${zoneSlug}?format=png`,
      `Download SVG: ${base}/api/qr/${setId}/${zoneSlug}?format=svg`,
      `Print sheet: ${base}/properties/${propertyId}/print`,
    ].join("\n"),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
