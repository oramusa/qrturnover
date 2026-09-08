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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: property } = await supabase
    .from("properties")
    .select("name")
    .eq("id", id)
    .single();

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
      <div className="max-w-3xl mx-auto p-6 print:p-0">
      <Link
        href={`/properties/${id}`}
        className="text-sm text-muted underline print:hidden"
      >
        &larr; Back to property
      </Link>

      <div className="flex items-center gap-3 mt-4 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QRTurnover" className="w-10 h-10 object-contain" />
        <h1 className="text-xl font-semibold">
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
            className="border rounded-lg p-3 flex flex-col items-center text-center break-inside-avoid"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zone.qr} alt={`QR code for ${zone.name}`} className="w-32 h-32" />
            <p className="text-sm font-medium mt-2">
              {zone.name}
              {claim && <span className="font-normal text-muted"> / {setLabel}</span>}
            </p>
            <div className="flex items-center gap-2 mt-1 print:hidden">
              <a
                href={`/api/qr/${claim!.set_id}/${zone.slug}?format=png`}
                className="text-xs text-muted underline"
              >
                PNG
              </a>
              <a
                href={`/api/qr/${claim!.set_id}/${zone.slug}?format=svg`}
                className="text-xs text-muted underline"
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
