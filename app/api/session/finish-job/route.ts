import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { sessionId, cleanerId } = await req.json();
  if (!sessionId || !cleanerId) {
    return NextResponse.json({ error: "Missing sessionId or cleanerId" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: session } = await supabase
    .from("turnover_sessions")
    .select(
      `id, status, job_started_at, property_id, cleaner_id,
       properties ( name, hosts ( email ) ),
       cleaners ( name )`
    )
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 400 });
  }
  if (session.status !== "in_progress") {
    // Most likely the host already marked it complete from their side.
    return NextResponse.json(
      { error: "This turnover was already marked complete.", alreadyDone: true },
      { status: 400 }
    );
  }
  if (!session.job_started_at || session.cleaner_id !== cleanerId) {
    return NextResponse.json({ error: "Cleaner is not assigned to this turnover" }, { status: 403 });
  }

  const { data: assignment } = await supabase
    .from("property_cleaners")
    .select("cleaner_id")
    .eq("property_id", session.property_id)
    .eq("cleaner_id", cleanerId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Cleaner is not assigned to this property" }, { status: 403 });
  }

  const { data: claim } = await supabase
    .from("property_set_claims")
    .select("set_id")
    .eq("property_id", session.property_id)
    .is("released_at", null)
    .maybeSingle();

  const { data: zones } = claim
    ? await supabase.from("qr_set_zones").select("zone_slug, zone_label").eq("set_id", claim.set_id)
    : { data: [] as { zone_slug: string; zone_label: string }[] };

  const { data: scans } = await supabase
    .from("scan_events")
    .select("zone_slug")
    .eq("session_id", sessionId);

  const scannedZoneSlugs = new Set((scans ?? []).map((s) => s.zone_slug));
  const pendingZones = (zones ?? []).filter((z) => !scannedZoneSlugs.has(z.zone_slug));

  if (pendingZones.length > 0) {
    return NextResponse.json(
      {
        error: `${pendingZones.length} zone${pendingZones.length === 1 ? "" : "s"} still pending: ${pendingZones
          .map((z) => z.zone_label)
          .join(", ")}`,
      },
      { status: 400 }
    );
  }

  const finishedAt = new Date();

  const { error: updateError } = await supabase
    .from("turnover_sessions")
    .update({
      job_finished_at: finishedAt.toISOString(),
      status: "complete",
      completed_at: finishedAt.toISOString(),
    })
    .eq("id", sessionId)
    .eq("status", "in_progress")
    .eq("cleaner_id", cleanerId);

  if (updateError) {
    return NextResponse.json({ error: "Couldn't finish this job" }, { status: 500 });
  }

  const property = session.properties as unknown as { name: string; hosts: { email: string } };
  const cleaner = session.cleaners as unknown as { name: string } | null;
  const hostEmail = property?.hosts?.email;

  let durationText = "";
  if (session.job_started_at) {
    const minutes = Math.round(
      (finishedAt.getTime() - new Date(session.job_started_at).getTime()) / 60000
    );
    durationText = ` (took ${minutes} min)`;
  }

  if (hostEmail) {
    await sendEmail({
      to: hostEmail,
      subject: `Turnover complete at ${property.name}`,
      text: `${cleaner?.name ?? "Your cleaner"} finished the turnover at ${property.name}${durationText}.`,
    });
  }

  return NextResponse.json({ ok: true });
}
