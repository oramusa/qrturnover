import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

// Fire-and-forget admin notification — never blocks property creation, so
// this intentionally always returns 200-ish even on a soft failure. The
// service role client is used because this fires right after signup/property
// creation, before any RLS-relevant session state can be assumed stable.
export async function POST(req: NextRequest) {
  const { propertyId } = await req.json();
  if (!propertyId) {
    return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: property } = await supabase
    .from("properties")
    .select("name, host_id, hosts ( email, mailing_address )")
    .eq("id", propertyId)
    .single();

  const { data: claim } = await supabase
    .from("property_set_claims")
    .select("set_id")
    .eq("property_id", propertyId)
    .is("released_at", null)
    .maybeSingle();

  if (!property || !claim) {
    return NextResponse.json({ error: "Property or claim not found" }, { status: 404 });
  }

  const host = property.hosts as unknown as { email: string; mailing_address: string | null };
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "oramusa@gmail.com";

  await sendEmail({
    to: adminEmail,
    subject: `New property "${property.name}" — QR set ${claim.set_id} assigned`,
    text: [
      `Host: ${host?.email ?? "unknown"}`,
      `Property: ${property.name}`,
      `QR set: ${claim.set_id}`,
      `Mailing address: ${host?.mailing_address?.trim() || "(not provided yet)"}`,
      "",
      `Print sheet: ${base}/properties/${propertyId}/print`,
    ].join("\n"),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
