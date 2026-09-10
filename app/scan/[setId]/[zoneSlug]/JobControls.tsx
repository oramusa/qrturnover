"use client";

import { useState } from "react";

export default function JobControls({
  sessionId,
  cleanerId,
  jobStartedAt,
  jobFinishedAt,
  onChange,
}: {
  sessionId: string;
  cleanerId: string;
  jobStartedAt: string | null;
  jobFinishedAt: string | null;
  onChange: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);

  async function startJob() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/session/start-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, cleanerId }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't start the job. Please try again.");
      return;
    }
    onChange();
  }

  async function finishJob() {
    if (!confirm("Mark this turnover as finished?")) {
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/session/finish-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, cleanerId }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      if (body.alreadyDone) {
        setAlreadyDone(true);
        return;
      }
      setError(body.error ?? "Couldn't finish the job. Please try again.");
      return;
    }
    onChange();
  }

  if (alreadyDone) {
    return (
      <div className="mt-4 text-sm bg-green-50 text-green-800 rounded p-3">
        This turnover was already marked complete — nothing more to do here. Thanks!
      </div>
    );
  }

  if (jobFinishedAt) {
    return (
      <div className="mt-4 text-sm bg-green-50 text-green-800 rounded p-3">
        Job finished — thanks! You can close this page.
      </div>
    );
  }

  if (!jobStartedAt) {
    return (
      <div className="mt-4">
        <button
          onClick={startJob}
          disabled={loading}
          className="w-full bg-black text-white rounded py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Starting..." : "Start job"}
        </button>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between bg-gray-50 rounded p-3">
        <span className="text-sm text-gray-600">Job in progress — scan each zone below</span>
        <button
          onClick={finishJob}
          disabled={loading}
          className="text-sm border rounded px-3 py-2 bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50"
        >
          Finish job
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
