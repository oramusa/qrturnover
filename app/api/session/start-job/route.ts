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
    .select("id, status, job_started_at, property_id, cleaner_id, properties ( name, hosts ( email ) )")
    .eq("id", sessionId)
    .single();

  if (!session || session.status !== "in_progress") {
    return NextResponse.json({ error: "Session not found or not active" }, { status: 400 });
  }

  const { data: assignment } = await supabase
    .from("property_cleaners")
    .select("cleaner_id")
    .eq("property_id", session.property_id)
    .eq("cleaner_id", cleanerId)
    .maybeSingle();

  if (!assignment || (session.cleaner_id && session.cleaner_id !== cleanerId)) {
    return NextResponse.json({ error: "Cleaner is not assigned to this turnover" }, { status: 403 });
  }
  if (session.job_started_at) {
    return NextResponse.json({ ok: true }); // already started, no-op
  }

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("name")
    .eq("id", cleanerId)
    .single();

  const { error: updateError } = await supabase
    .from("turnover_sessions")
    .update({ cleaner_id: cleanerId, job_started_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("job_started_at", null);

  if (updateError) {
    return NextResponse.json({ error: "Couldn't start this job" }, { status: 500 });
  }

  const property = session.properties as unknown as { name: string; hosts: { email: string } };
  const hostEmail = property?.hosts?.email;
  if (hostEmail) {
    await sendEmail({
      to: hostEmail,
      subject: `${cleaner?.name ?? "A cleaner"} started at ${property.name}`,
      text: `${cleaner?.name ?? "A cleaner"} just started the turnover at ${property.name}.`,
    });
  }

  return NextResponse.json({ ok: true });
}
