import { privateMetadata } from "@/lib/privateMetadata";

export const metadata = { ...privateMetadata, title: "History" };
export default function HistoryLayout({ children }: LayoutProps<"/history">) { return children; }
