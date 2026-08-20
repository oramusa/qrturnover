import { createClient } from "@/lib/supabase/server";
import AppNav from "@/app/components/AppNav";
import BillingCard from "@/app/dashboard/BillingCard";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
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

  const now = new Date();
  const trialDaysLeft = host?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(host.trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;

  return (
    <>
      <AppNav current="/account" />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">Account</h1>

        {params.checkout === "success" && (
          <p className="text-sm bg-green-50 text-green-800 rounded p-3 mb-6">
            Payment successful — thanks for subscribing! It may take a moment for your status
            below to update.
          </p>
        )}

        <div className="border rounded-lg p-4 mb-6">
          <p className="text-xs text-gray-500">Email</p>
          <p className="text-sm mt-1">{user?.email}</p>
        </div>

        <h2 className="text-sm font-medium mb-2">Billing</h2>
        <BillingCard
          subscriptionStatus={host?.subscription_status ?? null}
          trialDaysLeft={trialDaysLeft}
        />
      </div>
    </>
  );
}
