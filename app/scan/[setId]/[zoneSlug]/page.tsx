import ScanClient from "./ScanClient";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ setId: string; zoneSlug: string }>;
}) {
  const { setId, zoneSlug } = await params;
  return <ScanClient setId={setId} zoneSlug={zoneSlug} />;
}
