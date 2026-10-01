import { privateMetadata } from "@/lib/privateMetadata";

export const metadata = { ...privateMetadata, title: "Zone Scan" };
export default function ScanLayout({ children }: { children: React.ReactNode }) { return children; }
