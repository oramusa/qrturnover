import { privateMetadata } from "@/lib/privateMetadata";

export const metadata = { ...privateMetadata, title: "Properties" };
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) { return children; }
