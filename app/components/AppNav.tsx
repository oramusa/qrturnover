import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Properties" },
  { href: "/cleaners", label: "Cleaners" },
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
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center shrink-0" aria-label="QRTurnover dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand-logo-dark.png"
            alt="QRTurnover"
            className="w-40 h-10 object-contain object-left"
          />
        </Link>
        <nav className="flex items-center gap-1 text-sm overflow-x-auto flex-nowrap min-w-0 ml-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-md transition-colors shrink-0 whitespace-nowrap ${
                current === item.href
                  ? "bg-white text-gray-900"
                  : "text-muted hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <form action="/api/auth/signout" method="post" className="ml-2 shrink-0">
            <button className="text-sm text-muted hover:text-white px-3 py-1.5 whitespace-nowrap">
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
