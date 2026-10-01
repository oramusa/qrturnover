import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public route — anyone (logged in or not) can reach the contact form.
export async function POST(req: NextRequest) {
  const rateLimit = await checkRateLimit(req, "contact", 5, 60 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please wait and try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { name, email, message } = body as Record<string, unknown>;

  if (typeof message !== "string" || !message.trim() || message.length > 5000) {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  }
  if (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (name !== undefined && (typeof name !== "string" || name.length > 100)) {
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  }

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "admin@qrturnover.com";

  try {
    await sendEmail({
      to: adminEmail,
      subject: `Contact form: ${typeof name === "string" && name.trim() ? name.trim() : email}`,
      text: [`From: ${typeof name === "string" ? name.trim() : ""} <${email}>`, "", message.trim()].join("\n"),
      replyTo: email,
    });
  } catch (error) {
    console.error("Contact email failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Couldn't send your message. Please try again." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
