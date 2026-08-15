import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import ScanForm from "./ScanForm";
import CleanerLoginForm from "./CleanerLoginForm";
import JobControls from "./JobControls";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  const supabase = createServiceRoleClient();
  const cookieStore = await cookies();
  const cleanerId = cookieStore.get("cleaner_id")?.value ?? null;
  const cleanerName = cookieStore.get("cleaner_name")?.value ?? null;

  const { data: zone } = await supabase
    .from("zones")
    .select("id, name, task_description, checklist_items, require_photo, property_id, properties ( name, host_id )")
    .eq("id", zoneId)
    .single();

  if (!zone) {
    return (
      <div className="max-w-sm mx-auto p-6 mt-16 text-center">
        <p className="text-gray-500">This QR code isn't recognized. Ask your host for a new one.</p>
      </div>
    );
  }

  // If this device hasn't identified a cleaner yet, require the access code first —
  // everything else (zone name, job controls) waits until we know who's scanning.
  if (!cleanerId) {
    return (
      <div className="max-w-sm mx-auto p-6 mt-12">
        <p className="text-sm text-gray-500">
          {(zone.properties as unknown as { name: string })?.name}
        </p>
        <h1 className="text-2xl font-semibold mt-1">{zone.name}</h1>
        <p className="text-gray-600 mt-4">
          Enter the code your host gave you to get started.
        </p>
        <CleanerLoginForm zoneId={zone.id} />
      </div>
    );
  }

  // Find (or note there isn't) an active turnover session for this property
  const { data: activeSession } = await supabase
    .from("turnover_sessions")
    .select("id, cleaner_id, job_started_at, job_finished_at")
    .eq("property_id", zone.property_id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-sm mx-auto p-6 mt-12">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {(zone.properties as unknown as { name: string })?.name}
        </p>
        <span className="text-xs bg-gray-100 rounded-full px-2 py-1 text-gray-600">
          {cleanerName}
        </span>
      </div>

      <h1 className="text-2xl font-semibold">{zone.name}</h1>
      {zone.task_description && (
        <p className="text-gray-600 mt-2">{zone.task_description}</p>
      )}
      {zone.checklist_items && (
        <ul className="mt-3 space-y-1">
          {zone.checklist_items
            .split("\n")
            .filter((line: string) => line.trim())
            .map((line: string, i: number) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">&#9633;</span>
                {line.trim()}
              </li>
            ))}
        </ul>
      )}

      {!activeSession ? (
        <p className="mt-6 text-sm text-amber-700 bg-amber-50 rounded p-3">
          No turnover has been started for this property yet. Ask your host to tap
          &quot;Start turnover&quot; in the app, then scan again.
        </p>
      ) : (
        <>
          <JobControls
            sessionId={activeSession.id}
            cleanerId={cleanerId}
            jobStartedAt={activeSession.job_started_at}
            jobFinishedAt={activeSession.job_finished_at}
          />
          {activeSession.job_started_at && !activeSession.job_finished_at && (
            <ScanForm
              zoneId={zone.id}
              sessionId={activeSession.id}
              cleanerId={cleanerId}
              requirePhoto={zone.require_photo}
            />
          )}
        </>
      )}
    </div>
  );
}
