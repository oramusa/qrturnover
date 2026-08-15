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
    .select("id, status, job_started_at, property_id, properties ( name, hosts ( email ) )")
    .eq("id", sessionId)
    .single();

  if (!session || session.status !== "in_progress") {
    return NextResponse.json({ error: "Session not found or not active" }, { status: 400 });
  }
  if (session.job_started_at) {
    return NextResponse.json({ ok: true }); // already started, no-op
  }

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("name")
    .eq("id", cleanerId)
    .single();

  await supabase
    .from("turnover_sessions")
    .update({ cleaner_id: cleanerId, job_started_at: new Date().toISOString() })
    .eq("id", sessionId);

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
