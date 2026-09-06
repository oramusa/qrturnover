import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public route — anyone (logged in or not) can reach the contact form.
export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json();

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "admin@qrturnover.com";

  await sendEmail({
    to: adminEmail,
    subject: `Contact form: ${typeof name === "string" && name.trim() ? name.trim() : email}`,
    text: [`From: ${typeof name === "string" ? name.trim() : ""} <${email}>`, "", message.trim()].join(
      "\n"
    ),
    replyTo: email,
  });

  return NextResponse.json({ ok: true });
}
