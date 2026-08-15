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

  if (!session || session.status !== "in_progress") {
    return NextResponse.json({ error: "Session not found or not active" }, { status: 400 });
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
