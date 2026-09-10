import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";

// Cleaners don't have passwords — they enter a short code the host gave them once.
// On success we set a cookie so they don't have to re-enter it at every zone on
// the same device. This is intentionally low-friction, not bank-grade auth: a
// forged cookie could misattribute a scan, but can't access any host data or
// do anything more sensitive than "mark a zone done as the wrong cleaner."
export async function POST(req: NextRequest) {
  const rateLimit = await checkRateLimit(req, "cleaner-auth", 10, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many code attempts. Please wait 15 minutes and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const { setId, code } = await req.json();

  if (!setId || !code) {
    return NextResponse.json({ error: "Missing setId or code" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: claim } = await supabase
    .from("property_set_claims")
    .select("property_id, properties ( host_id )")
    .eq("set_id", setId)
    .is("released_at", null)
    .maybeSingle();

  if (!claim) {
    return NextResponse.json({ error: "This QR sheet isn't assigned to a property yet" }, { status: 404 });
  }

  const hostId = (claim.properties as unknown as { host_id: string })?.host_id;

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("id, name")
    .eq("host_id", hostId)
    .eq("access_code", code.trim().toUpperCase())
    .maybeSingle();

  if (!cleaner) {
    return NextResponse.json({ error: "Code not recognized" }, { status: 401 });
  }

  const { data: assignment } = await supabase
    .from("property_cleaners")
    .select("cleaner_id")
    .eq("property_id", claim.property_id)
    .eq("cleaner_id", cleaner.id)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json(
      { error: "This cleaner is not assigned to this property" },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, id: cleaner.id, name: cleaner.name });
}
