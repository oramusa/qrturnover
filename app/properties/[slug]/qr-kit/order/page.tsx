import Link from "next/link";
import { redirect } from "next/navigation";
import AppNav from "@/app/components/AppNav";
import { createClient } from "@/lib/supabase/server";
import PortfolioOrderForm from "./PortfolioOrderForm";

export default async function WaterproofKitOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userId = user.id;

  const [{ data: property }, { data: host }, { data: hostProperties }] = await Promise.all([
    supabase.from("properties").select("id, name, address").eq("slug", slug).eq("host_id", userId).single(),
    supabase.from("hosts").select("address_line, city, state, zip_code, country").eq("id", userId).single(),
    supabase.from("properties").select("id, name, address").eq("host_id", userId).order("name"),
  ]);

  if (!property) return <div className="p-6">Property not found.</div>;

  const propertyIds = (hostProperties ?? []).map((item) => item.id);
  const { data: claims } = propertyIds.length > 0 ? await supabase
    .from("property_set_claims")
    .select("property_id, set_id")
    .in("property_id", propertyIds)
    .is("released_at", null) : { data: [] as { property_id: string; set_id: string }[] };
  const setIds = (claims ?? []).map((claim) => claim.set_id);
  const { data: setZones } = setIds.length > 0
    ? await supabase
        .from("qr_set_zones")
        .select("set_id")
        .in("set_id", setIds)
    : { data: [] as { set_id: string }[] };
  const propertyBySet = new Map((claims ?? []).map((claim) => [claim.set_id, claim.property_id]));
  const roomCountByProperty = new Map<string, number>();
  for (const zone of setZones ?? []) {
    const propertyId = propertyBySet.get(zone.set_id);
    if (propertyId) roomCountByProperty.set(propertyId, (roomCountByProperty.get(propertyId) ?? 0) + 1);
  }
  const orderProperties = (hostProperties ?? []).map((item) => ({
    ...item,
    roomCount: roomCountByProperty.get(item.id) ?? 0,
    isCurrent: item.id === property.id,
  })).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  const addressComplete = Boolean(host?.address_line && host.city && host.state && host.zip_code && host.country);
  const address = [host?.address_line, host?.city, host?.state, host?.zip_code, host?.country].filter(Boolean).join(", ");

  return (
    <div>
      <AppNav current="/dashboard" />
      <main className="max-w-4xl mx-auto p-6 sm:py-10">
        <Link href={`/properties/${slug}/qr-kit`} className="text-sm text-green-500 hover:text-green-400">
          &larr; Back to QR Kit
        </Link>
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-500 mb-2">Review your order</p>
          <h1 className="text-3xl font-semibold">Waterproof QR Kit</h1>
          <p className="text-sm text-muted mt-2">Confirm the property and rooms before continuing to Stripe.</p>
        </div>

        {roomCountByProperty.get(property.id) ? (
          <PortfolioOrderForm properties={orderProperties} address={addressComplete ? address : null} />
        ) : (
          <p className="mt-8 rounded-xl border border-amber-900 bg-amber-950/30 p-5 text-sm text-amber-200">Add at least one room to this property before ordering a kit.</p>
        )}
      </main>
    </div>
  );
}
