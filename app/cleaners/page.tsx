import { createClient } from "@/lib/supabase/server";
import NewCleanerForm from "./NewCleanerForm";
import DeleteCleanerButton from "./DeleteCleanerButton";
import AppNav from "@/app/components/AppNav";

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

  return (
    <div>
      <AppNav current="/cleaners" />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">Cleaners</h1>

        <NewCleanerForm />

        <div className="space-y-3 mt-8">
          {cleaners?.length === 0 && (
            <p className="text-muted text-sm">
              No cleaners added yet. Add one above, then assign them to properties.
            </p>
          )}
          {cleaners?.map((cleaner) => (
            <div key={cleaner.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{cleaner.name}</p>
                  {cleaner.contact && (
                    <p className="text-sm text-muted">{cleaner.contact}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono bg-gray-100 text-gray-900 px-2 py-1 rounded">
                    {cleaner.access_code}
                  </span>
                  <DeleteCleanerButton cleanerId={cleaner.id} cleanerName={cleaner.name} />
                </div>
              </div>
              <p className="text-xs text-muted mt-2">
                {cleaner.property_cleaners?.length
                  ? `Assigned to: ${cleaner.property_cleaners
                      .map((pc) => (pc.properties as unknown as { name: string })?.name)
                      .join(", ")}`
                  : "Not assigned to any property yet — assign from the property page."}
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted mt-6">
          Share each cleaner&apos;s access code with them once — they&apos;ll enter it the first
          time they scan a QR code, and their device will remember it after that.
        </p>
      </div>
    </div>
  );
}
