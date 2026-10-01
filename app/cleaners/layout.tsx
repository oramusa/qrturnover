import { privateMetadata } from "@/lib/privateMetadata";

export const metadata = { ...privateMetadata, title: "Cleaners" };
export default function CleanersLayout({ children }: LayoutProps<"/cleaners">) { return children; }
