import { privateMetadata } from "@/lib/privateMetadata";

export const metadata = { ...privateMetadata, title: "Sign up" };
export default function SignupLayout({ children }: LayoutProps<"/signup">) { return children; }
