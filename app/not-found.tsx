import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-emerald-500">404</p>
        <h1 className="mt-3 text-3xl font-bold">Page not found</h1>
        <p className="mt-4 text-muted">The page may have moved, or the address may be incorrect.</p>
        <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-500">
          Return to QRTurnover
        </Link>
      </div>
    </main>
  );
}
