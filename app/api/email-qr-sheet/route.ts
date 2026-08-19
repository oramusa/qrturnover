import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { zoneScanUrl } from "@/lib/qrcode";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Host-only route — sends the property's zone scan links to an email address,
// as an alternative to printing the QR sheet (e.g. no printer on hand, or the
// cleaner just wants to tap links directly on their phone).
export async function POST(req: NextRequest) {
  const { propertyId, email } = await req.json();
  if (!propertyId || !email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  // RLS scopes this to properties the logged-in host actually owns.
  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("id", propertyId)
    .single();
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const { data: zones } = await supabase
    .from("zones")
    .select("id, name")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true });

  if (!zones || zones.length === 0) {
    return NextResponse.json({ error: "This property has no zones yet" }, { status: 400 });
  }

  const lines = zones.map((z) => `${z.name}: ${zoneScanUrl(z.id)}`);
  await sendEmail({
    to: email,
    subject: `QR scan links — ${property.name}`,
    text: `Tap each link below to open that zone's scan page directly — no camera or printed code needed.\n\n${lines.join("\n")}`,
  });

  return NextResponse.json({ ok: true });
}
