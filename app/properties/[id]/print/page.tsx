import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { zoneQrDataUrl } from "@/lib/qrcode";
import PrintButton from "./PrintButton";

export default async function PrintSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("name")
    .eq("id", id)
    .single();

  const { data: zones } = await supabase
    .from("zones")
    .select("id, name")
    .eq("property_id", id)
    .order("sort_order", { ascending: true });

  const zonesWithQr = await Promise.all(
    (zones ?? []).map(async (zone) => ({
      ...zone,
      qr: await zoneQrDataUrl(zone.id),
    }))
  );

  return (
    <div className="max-w-3xl mx-auto p-6 print:p-0">
      <Link
        href={`/properties/${id}`}
        className="text-sm text-gray-500 underline print:hidden"
      >
        &larr; Back to property
      </Link>

      <div className="flex items-center justify-between mt-2 mb-6 print:hidden">
        <h1 className="text-xl font-semibold">
          Print QR codes — {property?.name}
        </h1>
        <PrintButton />
      </div>

      <p className="text-sm text-gray-500 mb-6 print:hidden">
        Print this page, cut each code apart, and stick one at each zone. Adhesive
        label sheets (e.g. Avery 5160) work well for a more durable result.
      </p>

      <div className="grid grid-cols-3 gap-6 print:grid-cols-3">
        {zonesWithQr.map((zone) => (
          <div
            key={zone.id}
            className="border rounded-lg p-3 flex flex-col items-center text-center break-inside-avoid"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zone.qr} alt={`QR code for ${zone.name}`} className="w-32 h-32" />
            <p className="text-sm font-medium mt-2">{zone.name}</p>
          </div>
        ))}
      </div>

      {zonesWithQr.length === 0 && (
        <p className="text-gray-500">No zones yet — add zones first, then come back here.</p>
      )}
    </div>
  );
}
