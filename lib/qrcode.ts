import QRCode from "qrcode";

// A zone's QR encodes {setId}/{zoneSlug} — stable regardless of which
// property currently has the physical sheet claimed. The scan page resolves
// that pair through the active property_set_claims row.
export function zoneScanUrl(setId: string, zoneSlug: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/scan/${setId}/${zoneSlug}`;
}

export async function zoneQrDataUrl(setId: string, zoneSlug: string): Promise<string> {
  const url = zoneScanUrl(setId, zoneSlug);
  // PNG data URL, easy to drop into <img> or a PDF
  return QRCode.toDataURL(url, { width: 300, margin: 1 });
}
