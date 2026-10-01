import { privateMetadata } from "@/lib/privateMetadata";

export const metadata = { ...privateMetadata, title: "Property" };
export default function PropertiesLayout({ children }: { children: React.ReactNode }) { return children; }
