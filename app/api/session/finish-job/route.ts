import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
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

  const { data: zones } = await supabase
    .from("zones")
    .select("id, name")
    .eq("property_id", session.property_id);

  const { data: scans } = await supabase
    .from("scan_records")
    .select("zone_id")
    .eq("session_id", sessionId);

  const scannedZoneIds = new Set((scans ?? []).map((s) => s.zone_id));
  const pendingZones = (zones ?? []).filter((z) => !scannedZoneIds.has(z.id));

  if (pendingZones.length > 0) {
    return NextResponse.json(
      {
        error: `${pendingZones.length} zone${pendingZones.length === 1 ? "" : "s"} still pending: ${pendingZones
          .map((z) => z.name)
          .join(", ")}`,
      },
      { status: 400 }
    );
  }

  const finishedAt = new Date();

  await supabase
    .from("turnover_sessions")
    .update({
      job_finished_at: finishedAt.toISOString(),
      status: "complete",
      completed_at: finishedAt.toISOString(),
    })
    .eq("id", sessionId);

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
