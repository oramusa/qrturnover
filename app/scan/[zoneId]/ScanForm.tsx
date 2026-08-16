"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScanForm({
  zoneId,
  sessionId,
  cleanerId,
  requirePhoto,
  allItemsChecked,
}: {
  zoneId: string;
  sessionId: string;
  cleanerId: string;
  requirePhoto?: boolean;
  allItemsChecked: boolean;
}) {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (requirePhoto && !photo) {
      setError("A photo is required for this zone before you can mark it done.");
      return;
    }

    setError(null);
    setStatus("submitting");

    const formData = new FormData();
    formData.append("zoneId", zoneId);
    formData.append("sessionId", sessionId);
    formData.append("cleanerId", cleanerId);
    if (photo) formData.append("photo", photo);

    const res = await fetch("/api/scan", { method: "POST", body: formData });

    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <div className="mt-6 text-center">
        <div className="text-4xl mb-2">✅</div>
        <p className="font-medium">Marked done — thank you!</p>
        <p className="text-sm text-gray-500 mt-1">
          Scan the next zone's code when you're ready.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm border rounded px-4 py-2 hover:bg-gray-50"
        >
          &larr; Back
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <label className="block">
        <span className="text-sm text-gray-500">
          {requirePhoto ? "Add a photo (required for this zone)" : "Add a photo (optional)"}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            setPhoto(e.target.files?.[0] ?? null);
            setError(null);
          }}
          className="block w-full text-sm mt-1"
        />
      </label>
      {!allItemsChecked && (
        <p className="text-xs text-amber-700">Check off every item above before marking this zone done.</p>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={status === "submitting" || !allItemsChecked}
        className="w-full bg-black text-white rounded py-3 font-medium disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting..." : "Mark done"}
      </button>
      {status === "error" && (
        <p className="text-red-600 text-sm">Something went wrong — try again.</p>
      )}
    </form>
  );
}
