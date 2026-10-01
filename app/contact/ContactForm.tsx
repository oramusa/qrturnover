"use client";

import { useState } from "react";
import Link from "next/link";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't send your message — please try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Couldn't send your message — please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="mx-auto max-w-sm mt-24 p-6 text-center">
        <h1 className="text-2xl font-semibold mb-4">Message sent</h1>
        <p className="text-sm text-muted mb-6">Thanks for reaching out — we&apos;ll get back to you soon.</p>
        <Link href="/" className="text-sm underline">
          &larr; Back to QRTurnover
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm mt-24 p-6">
      <Link href="/" className="text-sm text-muted underline">
        &larr; Back
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-2">Contact us</h1>
      <p className="text-sm text-muted mb-6">
        Questions, feedback, or something not working? Send us a message.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label htmlFor="contact-name" className="block text-sm font-medium mb-1">Name <span className="text-muted font-normal">(optional)</span></label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2 bg-white text-gray-900"
        />
        <label htmlFor="contact-email" className="block text-sm font-medium mb-1">Email</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 bg-white text-gray-900"
        />
        <label htmlFor="contact-message" className="block text-sm font-medium mb-1">Message</label>
        <textarea
          id="contact-message"
          name="message"
          required
          maxLength={5000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full border rounded px-3 py-2 bg-white text-gray-900"
        />
        {error && <p role="alert" aria-live="polite" className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
        >
          {status === "sending" ? "Sending..." : "Send message"}
        </button>
      </form>
    </div>
  );
}
