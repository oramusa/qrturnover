import { privateMetadata } from "@/lib/privateMetadata";

export const metadata = { ...privateMetadata, title: "Account" };
export default function AccountLayout({ children }: LayoutProps<"/account">) { return children; }
