import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { zoneQrDataUrl } from "@/lib/qrcode";
import PrintButton from "./PrintButton";
import EmailQrForm from "./EmailQrForm";
import AppNav from "@/app/components/AppNav";
import { getHostSetNumber } from "@/lib/setLabel";

export default async function PrintSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  const { slug } = await params;
  const { layout } = await searchParams;
  const isStickerLayout = layout === "stickers";
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
      <div
        className="qr-print-sheet max-w-5xl mx-auto p-6 sm:py-10 print:p-0 print:max-w-none"
        data-layout={isStickerLayout ? "stickers" : "cards"}
      >
      <Link
        href={`/properties/${slug}`}
        className="text-sm text-green-400 hover:text-green-300 print:hidden"
      >
        &larr; Back to property
      </Link>

      <div className="flex items-center gap-4 mt-4 mb-2 flex-wrap print:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand-logo-light.png" alt="QRTurnover" className="w-44 h-14 object-contain object-left bg-white rounded-lg px-2" />
        <h1 className="text-2xl font-semibold break-words">
          {isStickerLayout ? "Sticker sheet" : "Print-at-home cards"} — {property?.name}
        </h1>
        <div className="flex items-center gap-2 ml-auto print:hidden">
          <EmailQrForm propertyId={id} />
          <PrintButton />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-6 print:hidden flex-wrap">
        <p className="text-sm text-muted max-w-2xl">
          {isStickerLayout
            ? "Load Avery 5163/8163-style 2 × 4 inch label paper and print at Actual Size / 100%."
            : "Use US Letter paper and print at Actual Size / 100%. Cut on the card borders."}
        </p>
        <Link href={`/properties/${slug}/qr-kit`} className="text-sm text-green-400 hover:text-green-300">
          Change format
        </Link>
      </div>

      <div className={`qr-print-grid grid grid-cols-1 sm:grid-cols-2 gap-4 ${isStickerLayout ? "qr-print-grid--stickers" : "qr-print-grid--cards"}`}>
        {zonesWithQr.map((zone) => (
          <div
            key={zone.slug}
            className="qr-print-card border border-gray-800 bg-gray-950 rounded-xl p-4 flex flex-col items-center justify-center text-center break-inside-avoid print:border-gray-400 print:bg-white print:rounded-none"
          >
            <div className="qr-print-code-wrap bg-white rounded-lg p-2 print:p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zone.qr} alt={`QR code for ${zone.name}`} className="qr-print-code w-40 h-40" />
            </div>
            <div className="qr-print-details flex flex-col items-center text-center min-w-0">
              <div className="hidden print:flex items-center gap-2 mb-1 text-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand-icon-192.png" alt="" className="w-6 h-6" />
                <span className="text-xs font-semibold">QRTurnover</span>
              </div>
              <p className="hidden print:block text-[10px] uppercase tracking-wider text-gray-500 mb-1 max-w-full truncate">
                {property.name}
              </p>
              <p className="text-base font-semibold mt-2 print:mt-0 print:text-gray-900">
                {zone.name}
              </p>
              {claim && <p className="text-xs text-gray-400 print:text-gray-500">{setLabel}</p>}
              <p className="hidden print:block text-[10px] text-gray-600 mt-1">Scan to open this room&apos;s cleaning checklist</p>
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
