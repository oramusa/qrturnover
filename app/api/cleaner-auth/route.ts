import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Cleaners don't have passwords — they enter a short code the host gave them once.
// On success we set a cookie so they don't have to re-enter it at every zone on
// the same device. This is intentionally low-friction, not bank-grade auth: a
// forged cookie could misattribute a scan, but can't access any host data or
// do anything more sensitive than "mark a zone done as the wrong cleaner."
export async function POST(req: NextRequest) {
  const { zoneId, code } = await req.json();

  if (!zoneId || !code) {
    return NextResponse.json({ error: "Missing zoneId or code" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: zone } = await supabase
    .from("zones")
    .select("property_id, properties ( host_id )")
    .eq("id", zoneId)
    .single();

  if (!zone) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  const hostId = (zone.properties as unknown as { host_id: string })?.host_id;

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("id, name")
    .eq("host_id", hostId)
    .eq("access_code", code.trim().toUpperCase())
    .maybeSingle();

  if (!cleaner) {
    return NextResponse.json({ error: "Code not recognized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, id: cleaner.id, name: cleaner.name });
  const cookieOpts = {
    httpOnly: false, // client needs to read it to show "Logged in as X"
    maxAge: 60 * 60 * 24 * 90, // 90 days — cleaners shouldn't have to re-enter often
    sameSite: "lax" as const,
    path: "/",
  };
  response.cookies.set("cleaner_id", cleaner.id, cookieOpts);
  response.cookies.set("cleaner_name", cleaner.name, cookieOpts);

  return response;
}
