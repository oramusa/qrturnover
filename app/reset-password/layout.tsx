import { privateMetadata } from "@/lib/privateMetadata";

export const metadata = { ...privateMetadata, title: "Choose a new password" };
export default function ResetPasswordLayout({ children }: LayoutProps<"/reset-password">) { return children; }
