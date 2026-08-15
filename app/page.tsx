import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto p-6 mt-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        See exactly what got cleaned —
        <br />
        without calling anyone.
      </h1>
      <p className="text-gray-600 mt-4 text-lg">
        Stick a QR code at every zone in your rental. Your cleaner scans each one as
        they finish. You see real-time, per-zone proof — across every property you manage.
      </p>
      <div className="mt-8 flex gap-3 justify-center">
        <Link
          href="/signup"
          className="bg-black text-white rounded px-6 py-3 font-medium"
        >
          Start free 14-day trial
        </Link>
        <Link href="/login" className="border rounded px-6 py-3 font-medium">
          Log in
        </Link>
      </div>
      <p className="text-sm text-gray-400 mt-6">No credit card required to start.</p>
    </div>
  );
}
