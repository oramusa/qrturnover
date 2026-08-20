"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ScanForm({
  setId,
  zoneSlug,
  sessionId,
  cleanerId,
  requirePhoto,
  allItemsChecked,
  otherZones,
}: {
  setId: string;
  zoneSlug: string;
  sessionId: string;
  cleanerId: string;
  requirePhoto?: boolean;
  allItemsChecked: boolean;
  otherZones: { slug: string; name: string; done: boolean }[];
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const previewUrls = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotos((prev) => [...prev, ...Array.from(files)]);
    setError(null);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (requirePhoto && photos.length === 0) {
      setError("At least one photo is required for this zone before you can mark it done.");
      return;
    }

    setError(null);
    setStatus("submitting");

    const formData = new FormData();
    formData.append("setId", setId);
    formData.append("zoneSlug", zoneSlug);
    formData.append("sessionId", sessionId);
    formData.append("cleanerId", cleanerId);
    photos.forEach((photo) => formData.append("photos", photo));

    const res = await fetch("/api/scan", { method: "POST", body: formData });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong — try again.");
      setStatus("error");
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    const pendingZones = otherZones.filter((z) => !z.done);
    return (
      <div className="mt-6 text-center">
        <div className="text-4xl mb-2">✅</div>
        <p className="font-medium">Marked done — thank you!</p>

        {pendingZones.length > 0 ? (
          <div className="mt-6 text-left">
            <p className="text-sm text-gray-500 mb-2 text-center">Scan next zone</p>
            <div className="space-y-2">
              {pendingZones.map((z) => (
                <Link
                  key={z.slug}
                  href={`/scan/${setId}/${z.slug}`}
                  className="block rounded-lg border px-4 py-3 bg-white text-gray-900 font-medium text-center active:bg-gray-100"
                >
                  {z.name}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-1">
            Every zone is scanned — tap &quot;Finish job&quot; above once you&apos;re done.
          </p>
        )}

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
          {requirePhoto ? "Add photos (at least one required for this zone)" : "Add photos (optional)"}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
          className="block w-full text-sm mt-1"
        />
      </label>

      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {previewUrls.map((url, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-16 h-16 rounded object-cover border"
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute -top-2 -right-2 bg-black text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

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
    </form>
  );
}
