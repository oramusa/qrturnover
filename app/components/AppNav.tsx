import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Properties" },
  { href: "/cleaners", label: "Cleaners" },
  { href: "/checklists", label: "Checklists" },
  { href: "/history", label: "History" },
  { href: "/account", label: "Account" },
] as const;

export default function AppNav({
  current,
}: {
  current?: (typeof NAV_ITEMS)[number]["href"];
}) {
  return (
    <header className="border-b border-gray-800">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-white rounded-md p-1 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="w-6 h-6 object-contain" />
          </span>
          QRTurnover
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                current === item.href
                  ? "bg-white text-gray-900"
                  : "text-muted hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <form action="/api/auth/signout" method="post" className="ml-2">
            <button className="text-sm text-muted hover:text-white px-3 py-1.5">
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
