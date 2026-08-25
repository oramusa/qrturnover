import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { zoneScanUrl } from "@/lib/qrcode";

// Public route — a QR code only encodes {setId}/{zoneSlug}, the same scan URL
// already visible (and public) on the print page, so no auth is needed here.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ setId: string; zoneSlug: string }> }
) {
  const { setId, zoneSlug } = await params;
  const format = req.nextUrl.searchParams.get("format") === "svg" ? "svg" : "png";
  const url = zoneScanUrl(setId, zoneSlug);
  const filename = `${setId}-${zoneSlug}.${format}`;

  if (format === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", width: 1024, margin: 1 });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const png = await QRCode.toBuffer(url, { width: 1024, margin: 1 });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
