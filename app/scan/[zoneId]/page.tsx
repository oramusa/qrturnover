import ScanClient from "./ScanClient";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  return <ScanClient zoneId={zoneId} />;
}
