import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NewPropertyForm from "./NewPropertyForm";
import BillingCard from "./BillingCard";
import AppNav from "@/app/components/AppNav";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: host, error: hostError } = await supabase
    .from("hosts")
    .select("subscription_status, trial_ends_at")
    .eq("id", user!.id)
    .single();

  if (hostError) {
    console.error("Failed to load host billing info:", hostError);
  }

  const trialDaysLeft = host?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(host.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const { data: properties } = await supabase
    .from("properties")
    .select(
      `
      id, name, address,
      zones ( id ),
      turnover_sessions ( id, status, started_at )
    `
    )
    .eq("host_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <AppNav current="/dashboard" />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-8">Your properties</h1>

        <BillingCard
          subscriptionStatus={host?.subscription_status ?? null}
          trialDaysLeft={trialDaysLeft}
        />

        <NewPropertyForm />

        <div className="grid gap-4 mt-8">
          {properties?.length === 0 && (
            <p className="text-gray-500">
              No properties yet — add your first one above to generate its QR zone codes.
            </p>
          )}

          {properties?.map((property) => {
            const zoneCount = property.zones?.length ?? 0;
            const activeSession = property.turnover_sessions?.find(
              (s) => s.status === "in_progress"
            );

            return (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="border rounded-lg p-4 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-between"
              >
                <div>
                  <h2 className="font-medium">{property.name}</h2>
                  <p className="text-sm text-gray-500">
                    {zoneCount} zone{zoneCount === 1 ? "" : "s"}
                    {property.address ? ` · ${property.address}` : ""}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    activeSession
                      ? "bg-amber-100 text-amber-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {activeSession ? "Turnover in progress" : "No active turnover"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
