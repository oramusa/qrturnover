"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JobControls({
  sessionId,
  cleanerId,
  jobStartedAt,
  jobFinishedAt,
}: {
  sessionId: string;
  cleanerId: string;
  jobStartedAt: string | null;
  jobFinishedAt: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function startJob() {
    setLoading(true);
    await fetch("/api/session/start-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, cleanerId }),
    });
    setLoading(false);
    router.refresh();
  }

  async function finishJob() {
    if (!confirm("Mark this turnover as finished? Make sure every zone is scanned first.")) {
      return;
    }
    setLoading(true);
    await fetch("/api/session/finish-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setLoading(false);
    router.refresh();
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
      <button
        onClick={startJob}
        disabled={loading}
        className="mt-4 w-full bg-black text-white rounded py-3 font-medium disabled:opacity-50"
      >
        {loading ? "Starting..." : "Start job"}
      </button>
    );
  }

  return (
    <div className="mt-4 flex items-center justify-between bg-gray-50 rounded p-3">
      <span className="text-sm text-gray-600">Job in progress — scan each zone below</span>
      <button
        onClick={finishJob}
        disabled={loading}
        className="text-sm border rounded px-3 py-2 bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50"
      >
        Finish job
      </button>
    </div>
  );
}
