import { privateMetadata } from "@/lib/privateMetadata";

export const metadata = { ...privateMetadata, title: "Log in" };
export default function LoginLayout({ children }: LayoutProps<"/login">) { return children; }
