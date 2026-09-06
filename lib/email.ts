// Minimal email helper using Resend (resend.com) — free tier covers ~3k emails/month,
// which is plenty for per-scan host notifications at this stage.
// If RESEND_API_KEY isn't set (e.g. local dev without it configured), this just
// logs instead of throwing, so the rest of the app keeps working.

export async function sendEmail({
  to,
  subject,
  text,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL || "notifications@qrturnover.app";

  if (!apiKey) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return;
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
  } catch (err) {
    // Notifications are best-effort — a failed email should never break the
    // cleaner's scan flow or the host's dashboard.
    console.error("Failed to send notification email", err);
  }
}
