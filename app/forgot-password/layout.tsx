import { privateMetadata } from "@/lib/privateMetadata";

export const metadata = { ...privateMetadata, title: "Reset password" };
export default function ForgotPasswordLayout({ children }: LayoutProps<"/forgot-password">) { return children; }
