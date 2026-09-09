import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { zoneQrDataUrl } from "@/lib/qrcode";
import PrintButton from "./PrintButton";
import EmailQrForm from "./EmailQrForm";
import AppNav from "@/app/components/AppNav";
import { getHostSetNumber } from "@/lib/setLabel";

export default async function PrintSheetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!property) {
    return <div className="p-6">Property not found.</div>;
  }
  const id = property.id;

  const { data: claim } = await supabase
    .from("property_set_claims")
    .select("set_id")
    .eq("property_id", id)
    .is("released_at", null)
    .maybeSingle();

  const hostSetNumber = claim ? await getHostSetNumber(supabase, user!.id, claim.set_id) : null;
  const setLabel = hostSetNumber ? `Set #${hostSetNumber}` : claim?.set_id;

  const { data: zones } = claim
    ? await supabase
        .from("qr_set_zones")
        .select("zone_slug, zone_label, sort_order")
        .eq("set_id", claim.set_id)
        .order("sort_order", { ascending: true })
    : { data: [] as { zone_slug: string; zone_label: string; sort_order: number }[] };

  const zonesWithQr = await Promise.all(
    (zones ?? []).map(async (zone) => ({
      slug: zone.zone_slug,
      name: zone.zone_label,
      qr: await zoneQrDataUrl(claim!.set_id, zone.zone_slug),
    }))
  );

  return (
    <>
      <div className="print:hidden">
        <AppNav />
      </div>
      <div className="max-w-5xl mx-auto p-6 sm:py-10 print:p-0 print:max-w-none">
      <Link
        href={`/properties/${slug}`}
        className="text-sm text-green-400 hover:text-green-300 print:hidden"
      >
        &larr; Back to property
      </Link>

      <div className="flex items-center gap-4 mt-4 mb-2 flex-wrap print:mt-0 print:mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand-logo-light.png" alt="QRTurnover" className="w-44 h-14 object-contain object-left bg-white rounded-lg px-2" />
        <h1 className="text-2xl font-semibold break-words">
          Print QR codes — {property?.name}
        </h1>
        <div className="flex items-center gap-2 ml-auto print:hidden">
          <EmailQrForm propertyId={id} />
          <PrintButton />
        </div>
      </div>

      <p className="text-sm text-muted mb-6 print:hidden">
        Print this page, cut each code apart, and stick one at each zone. Adhesive
        label sheets (e.g. Avery 5160) work well for a more durable result. Or send the
        links straight to a cleaner&apos;s phone instead — no printer needed.
      </p>

      <div className="grid grid-cols-3 gap-6 print:grid-cols-3">
        {zonesWithQr.map((zone) => (
          <div
            key={zone.slug}
            className="border border-gray-800 bg-gray-950 rounded-xl p-3 flex flex-col items-center text-center break-inside-avoid print:border-gray-300 print:bg-white"
          >
            <div className="bg-white rounded-lg p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zone.qr} alt={`QR code for ${zone.name}`} className="w-32 h-32" />
            </div>
            <p className="text-sm font-medium mt-2 print:text-gray-900">
              {zone.name}
              {claim && <span className="font-normal text-muted print:text-gray-500"> / {setLabel}</span>}
            </p>
            <div className="flex items-center gap-2 mt-1 print:hidden">
              <a
                href={`/api/qr/${claim!.set_id}/${zone.slug}?format=png`}
                className="text-xs text-green-400 hover:text-green-300"
              >
                PNG
              </a>
              <a
                href={`/api/qr/${claim!.set_id}/${zone.slug}?format=svg`}
                className="text-xs text-green-400 hover:text-green-300"
              >
                SVG
              </a>
            </div>
          </div>
        ))}
      </div>

      {zonesWithQr.length === 0 && (
        <p className="text-muted">
          {claim ? "This QR set has no zones defined." : "No QR set claimed for this property yet."}
        </p>
      )}
      </div>
    </>
  );
}
