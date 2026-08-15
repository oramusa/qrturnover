import QRCode from "qrcode";

// Every zone's QR encodes a stable URL: {appUrl}/scan/{zoneId}
// The cleaner's phone camera opens this directly — no in-app scanner needed.
export function zoneScanUrl(zoneId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/scan/${zoneId}`;
}

export async function zoneQrDataUrl(zoneId: string): Promise<string> {
  const url = zoneScanUrl(zoneId);
  // PNG data URL, easy to drop into <img> or a PDF
  return QRCode.toDataURL(url, { width: 300, margin: 1 });
}
