import Link from "next/link";
import { redirect } from "next/navigation";
import AppNav from "@/app/components/AppNav";
import { createClient } from "@/lib/supabase/server";
import OrderButton from "./OrderButton";

export default async function WaterproofKitOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userId = user.id;

  const [{ data: property }, { data: host }] = await Promise.all([
    supabase.from("properties").select("id, name, address").eq("slug", slug).single(),
    supabase.from("hosts").select("address_line, city, state, zip_code, country").eq("id", userId).single(),
  ]);

  if (!property) return <div className="p-6">Property not found.</div>;

  const { data: claim } = await supabase
    .from("property_set_claims")
    .select("set_id")
    .eq("property_id", property.id)
    .is("released_at", null)
    .maybeSingle();
  const { data: setZones } = claim
    ? await supabase
        .from("qr_set_zones")
        .select("zone_slug, zone_label, sort_order")
        .eq("set_id", claim.set_id)
        .order("sort_order", { ascending: true })
    : { data: [] as { zone_slug: string; zone_label: string; sort_order: number }[] };
  const zones = (setZones ?? []).map((zone) => ({ id: zone.zone_slug, name: zone.zone_label }));
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

        <div className="grid lg:grid-cols-[1fr_0.72fr] gap-6 mt-8 items-start">
          <section className="border border-gray-800 rounded-2xl bg-gray-950 p-6">
            <div className="flex justify-between gap-4 border-b border-gray-800 pb-5">
              <div>
                <p className="text-xs text-gray-400">Property</p>
                <h2 className="text-xl font-semibold mt-1">{property.name}</h2>
                {property.address && <p className="text-sm text-gray-400 mt-1">{property.address}</p>}
              </div>
              <span className="h-fit rounded-full bg-green-950 text-green-300 text-xs px-3 py-1.5">{zones.length} rooms</span>
            </div>
            <h3 className="text-sm font-medium mt-5">Included room labels</h3>
            <div className="flex flex-wrap gap-2 mt-3">
              {zones.map((zone) => <span key={zone.id} className="border border-gray-700 bg-gray-900 rounded-full px-3 py-1.5 text-xs text-gray-200">{zone.name}</span>)}
            </div>
            <ul className="mt-6 space-y-3 text-sm text-gray-300">
              <li className="flex gap-2"><span className="text-green-400">✓</span>One waterproof QR card for every room</li>
              <li className="flex gap-2"><span className="text-green-400">✓</span>Room name and scan instructions printed on each card</li>
              <li className="flex gap-2"><span className="text-green-400">✓</span>US shipping included</li>
            </ul>
          </section>

          <aside className="border border-gray-800 rounded-2xl bg-gray-950 p-6">
            <div className="flex justify-between text-sm"><span>Waterproof QR Kit</span><span>$39.00</span></div>
            <div className="flex justify-between text-sm text-gray-400 mt-3"><span>US shipping</span><span>Included</span></div>
            <div className="border-t border-gray-800 mt-5 pt-5 flex justify-between font-semibold"><span>Total</span><span>$39.00</span></div>

            <div className="mt-6 mb-5 rounded-xl bg-gray-900 p-4">
              <p className="text-xs text-gray-400">Saved delivery address</p>
              <p className="text-sm mt-1.5 text-gray-200">{addressComplete ? address : "No complete mailing address saved."}</p>
              <p className="text-xs text-gray-500 mt-2">You can confirm or change this address securely in Stripe.</p>
              {!addressComplete && <Link href="/account" className="inline-block text-xs text-green-400 mt-2">Add address in Account →</Link>}
            </div>

            {zones.length > 0 ? <OrderButton propertyId={property.id} /> : <p className="text-sm text-amber-300">Add at least one room before ordering a kit.</p>}
            <p className="text-[11px] text-gray-500 text-center mt-3">One-time payment. Your subscription will not change.</p>
          </aside>
        </div>
      </main>
    </div>
  );
}
