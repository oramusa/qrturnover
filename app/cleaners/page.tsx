import { createClient } from "@/lib/supabase/server";
import NewCleanerForm from "./NewCleanerForm";
import DeleteCleanerButton from "./DeleteCleanerButton";
import AppNav from "@/app/components/AppNav";
import AccessCode from "./AccessCode";

export default async function CleanersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: cleaners } = await supabase
    .from("cleaners")
    .select("id, name, contact, access_code, property_cleaners ( property_id, properties ( name ) )")
    .eq("host_id", user!.id)
    .order("created_at", { ascending: false });

  const assignedCleanerCount = (cleaners ?? []).filter(
    (cleaner) => (cleaner.property_cleaners?.length ?? 0) > 0
  ).length;

  return (
    <div>
      <AppNav current="/cleaners" />
      <div className="max-w-5xl mx-auto p-6 sm:py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-500 mb-2">
              Your team
            </p>
            <h1 className="text-3xl font-semibold">Cleaners</h1>
            <p className="text-sm text-muted mt-2 max-w-xl">
              Give every cleaner secure scan access and connect them to the right properties.
            </p>
          </div>
          <NewCleanerForm />
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-7">
          <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
            <p className="text-xs text-muted">Team members</p>
            <p className="text-2xl font-semibold mt-1">{cleaners?.length ?? 0}</p>
          </div>
          <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
            <p className="text-xs text-muted">Assigned</p>
            <p className="text-2xl font-semibold mt-1 text-green-400">{assignedCleanerCount}</p>
          </div>
          <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
            <p className="text-xs text-muted">Need assignment</p>
            <p className="text-2xl font-semibold mt-1">
              {(cleaners?.length ?? 0) - assignedCleanerCount}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mt-9">
          <div>
            <h2 className="text-lg font-medium">Team access</h2>
            <p className="text-xs text-muted mt-1">Access codes stay hidden until you need them.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          {cleaners?.length === 0 && (
            <p className="text-muted text-sm">
              No cleaners added yet. Add one above, then assign them to properties.
            </p>
          )}
          {cleaners?.map((cleaner) => (
            <div key={cleaner.id} className="border border-gray-800 rounded-xl p-5 bg-gray-950">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-green-950 text-green-300 flex items-center justify-center font-semibold shrink-0">
                    {cleaner.name.trim().charAt(0).toUpperCase() || "C"}
                  </span>
                  <div className="min-w-0">
                  <p className="font-medium break-words">{cleaner.name}</p>
                  {cleaner.contact && (
                    <p className="text-xs text-muted mt-0.5 break-words">{cleaner.contact}</p>
                  )}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                  cleaner.property_cleaners?.length
                    ? "bg-green-950 text-green-300"
                    : "bg-amber-950 text-amber-300"
                }`}>
                  {cleaner.property_cleaners?.length ? "Assigned" : "Unassigned"}
                </span>
              </div>
              <div className="border-t border-gray-800 mt-5 pt-4">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Access code</p>
                <AccessCode code={cleaner.access_code} />
              </div>
              <div className="flex items-end justify-between gap-3 mt-4">
              <p className="text-xs text-muted leading-relaxed">
                {cleaner.property_cleaners?.length
                  ? `Assigned to: ${cleaner.property_cleaners
                      .map((pc) => (pc.properties as unknown as { name: string })?.name)
                      .join(", ")}`
                  : "Not assigned to any property yet — assign from the property page."}
              </p>
              <DeleteCleanerButton cleanerId={cleaner.id} cleanerName={cleaner.name} />
              </div>
            </div>
          ))}
        </div>

        <div className="border border-blue-900/60 bg-blue-950/30 rounded-xl p-4 mt-6 flex gap-3">
          <span className="text-blue-300" aria-hidden="true">i</span>
          <p className="text-xs text-blue-100/80 leading-relaxed">
            Share each access code once. The cleaner enters it on their first QR scan, and their
            device remembers it for future turnovers.
          </p>
        </div>
      </div>
    </div>
  );
}
