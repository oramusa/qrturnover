"use client";

import { useEffect, useState } from "react";
import JobControls from "./JobControls";
import ScanForm from "./ScanForm";

type SessionData = {
  zone: {
    slug: string;
    name: string;
    task_description: string | null;
    checklist: { id: string; label: string; completed: boolean }[];
    require_photo: boolean;
    property_name: string;
  };
  cleaner: { id: string; name: string } | null;
  activeSession: { id: string; job_started_at: string | null; job_finished_at: string | null } | null;
  lastTurnoverJustFinished: boolean;
  otherZones: { slug: string; name: string; done: boolean }[];
};

export default function ScanClient({ setId, zoneSlug }: { setId: string; zoneSlug: string }) {
  const [data, setData] = useState<SessionData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [code, setCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);

  async function load() {
    const cleanerId = localStorage.getItem("cleaner_id");
    const url = cleanerId
      ? `/api/scan-session?setId=${setId}&zoneSlug=${zoneSlug}&cleanerId=${cleanerId}`
      : `/api/scan-session?setId=${setId}&zoneSlug=${zoneSlug}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      setLoadError(true);
      return;
    }
    const json: SessionData = await res.json();
    setData(json);
    // The stored cleanerId didn't match a real cleaner for this property's host —
    // clear it instead of getting stuck in a loop of failed lookups.
    if (cleanerId && !json.cleaner) {
      localStorage.removeItem("cleaner_id");
    }
  }

  useEffect(() => {
    load();

    // A cleaner's scan link is often reopened via mobile browser
    // back/forward-cache (bfcache) or an already-backgrounded tab, neither of
    // which re-runs this effect — so a host's edit (task description, photo
    // requirement, checklist) made while that page sat idle would never show
    // up. Re-fetch whenever the page becomes visible/active again.
    function handleVisible() {
      if (document.visibilityState === "visible") load();
    }
    window.addEventListener("pageshow", handleVisible);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("pageshow", handleVisible);
      document.removeEventListener("visibilitychange", handleVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, zoneSlug]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const typedCode = new FormData(e.currentTarget).get("code") as string;
    if (!typedCode?.trim()) {
      setLoginError("Enter the code your host gave you first.");
      return;
    }
    setLoginLoading(true);
    setLoginError(null);

    const res = await fetch("/api/cleaner-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId, code: typedCode }),
    });
    const body = await res.json().catch(() => ({}));
    setLoginLoading(false);

    if (!res.ok) {
      setLoginError(body.error || "Something went wrong");
      return;
    }

    localStorage.setItem("cleaner_id", body.id);
    localStorage.setItem("cleaner_name", body.name);
    load();
  }

  if (loadError) {
    return (
      <div className="max-w-sm mx-auto p-6 mt-16 text-center">
        <p className="text-muted">Couldn&apos;t load this page. Check your connection and try again.</p>
      </div>
    );
  }

  if (!data) {
    return <div className="max-w-sm mx-auto p-6 mt-16 text-center text-muted">Loading…</div>;
  }

  const { zone, cleaner, activeSession, lastTurnoverJustFinished } = data;

  if (!cleaner) {
    return (
      <div className="max-w-sm mx-auto p-6 mt-12">
        <p className="text-sm text-muted">{zone.property_name}</p>
        <h1 className="text-2xl font-semibold mt-1">{zone.name}</h1>
        <p className="text-muted mt-4">Enter the code your host gave you to get started.</p>
        <form onSubmit={handleLogin} className="mt-4 space-y-3">
          <input
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            required
            autoFocus
            autoCapitalize="characters"
            className="w-full border rounded px-4 py-3 text-lg tracking-widest text-center uppercase bg-white text-gray-900"
          />
          {loginError && <p className="text-red-600 text-sm">{loginError}</p>}
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full bg-black text-white rounded py-3 font-medium disabled:opacity-50"
          >
            {loginLoading ? "Checking..." : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto p-6 mt-12">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">{zone.property_name}</p>
        <span className="text-xs bg-gray-100 rounded-full px-2 py-1 text-gray-600">{cleaner.name}</span>
      </div>

      <h1 className="text-2xl font-semibold">{zone.name}</h1>
      {zone.task_description && <p className="text-muted mt-2">{zone.task_description}</p>}
      {zone.checklist.length > 0 && (
        <ul className="mt-3 space-y-2">
          {zone.checklist.map((item) => (
            <li key={item.id}>
              <label
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 bg-white text-gray-900 text-base ${
                  activeSession ? "active:bg-gray-100" : "opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={!activeSession}
                  className="w-6 h-6 shrink-0 accent-black"
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    setChecklistError(null);
                    const res = await fetch("/api/scan-item", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sessionId: activeSession?.id,
                        itemId: item.id,
                        completed: checked,
                      }),
                    });
                    if (!res.ok) {
                      setChecklistError("Couldn't save that — please try again.");
                    }
                    load();
                  }}
                />
                <span className={item.completed ? "line-through text-gray-500" : ""}>
                  {item.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {checklistError && <p className="text-red-600 text-sm mt-1">{checklistError}</p>}

      {!activeSession ? (
        <p className="mt-6 text-sm text-amber-700 bg-amber-50 rounded p-3">
          {lastTurnoverJustFinished
            ? "This turnover is already finished — thanks! Your host will start the next one before the next guest."
            : (
              <>
                No turnover has been started for this property yet. Ask your host to tap
                &quot;Start turnover&quot; in the app, then scan again.
              </>
            )}
        </p>
      ) : (
        <>
          <JobControls
            sessionId={activeSession.id}
            cleanerId={cleaner.id}
            jobStartedAt={activeSession.job_started_at}
            jobFinishedAt={activeSession.job_finished_at}
            onChange={load}
          />
          {activeSession.job_started_at && !activeSession.job_finished_at && (
            <ScanForm
              setId={setId}
              zoneSlug={zone.slug}
              sessionId={activeSession.id}
              cleanerId={cleaner.id}
              requirePhoto={zone.require_photo}
              allItemsChecked={zone.checklist.every((i) => i.completed)}
              otherZones={data.otherZones}
            />
          )}
        </>
      )}
    </div>
  );
}
