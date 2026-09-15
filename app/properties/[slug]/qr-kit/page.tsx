import Link from "next/link";
import AppNav from "@/app/components/AppNav";
import { createClient } from "@/lib/supabase/server";

export default async function QrKitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!property) {
    return <div className="p-6">Property not found.</div>;
  }

  return (
    <div>
      <AppNav current="/dashboard" />
      <main className="max-w-5xl mx-auto p-6 sm:py-10">
        <Link
          href={`/properties/${slug}`}
          className="text-sm text-green-500 hover:text-green-400"
        >
          &larr; Back to {property.name}
        </Link>

        <div className="mt-5 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-500 mb-2">
            QR Kit
          </p>
          <h1 className="text-3xl font-semibold">How would you like your QR codes?</h1>
          <p className="text-sm text-muted mt-2">
            Everything is already labeled for {property.name}. Choose a format and print—no design work required.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-8">
          <section className="border border-green-800 ring-1 ring-green-900 rounded-2xl p-6 bg-gray-950 flex flex-col">
            <div className="w-11 h-11 rounded-xl bg-green-950 text-green-300 flex items-center justify-center text-xl" aria-hidden="true">
              ⌂
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-green-400 mt-5">Recommended</p>
            <h2 className="text-xl font-semibold mt-1">Print at home</h2>
            <p className="text-sm text-gray-400 mt-2 flex-1">
              Large room cards on US Letter paper. Print, cut on the guides, and place each card in its room.
            </p>
            <Link
              href={`/properties/${slug}/print?layout=cards`}
              className="mt-6 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg px-4 py-3 text-center"
            >
              Open print-ready cards
            </Link>
          </section>

          <section className="border border-gray-800 rounded-2xl p-6 bg-gray-950 flex flex-col">
            <div className="w-11 h-11 rounded-xl bg-gray-900 text-green-300 flex items-center justify-center text-xl" aria-hidden="true">
              ▦
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mt-5">Peel and stick</p>
            <h2 className="text-xl font-semibold mt-1">Sticker paper</h2>
            <p className="text-sm text-gray-400 mt-2 flex-1">
              Ten 2 × 4 inch labels per US Letter sheet, formatted for Avery 5163/8163-style label paper.
            </p>
            <Link
              href={`/properties/${slug}/print?layout=stickers`}
              className="mt-6 border border-gray-700 hover:border-green-600 text-sm font-medium rounded-lg px-4 py-3 text-center"
            >
              Open sticker layout
            </Link>
          </section>

          <section className="border border-gray-800 rounded-2xl p-6 bg-gray-950 flex flex-col">
            <div className="w-11 h-11 rounded-xl bg-gray-900 text-green-300 flex items-center justify-center text-xl" aria-hidden="true">
              ✦
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 mt-5">Delivered to you</p>
            <h2 className="text-xl font-semibold mt-1">Waterproof kit</h2>
            <p className="text-sm text-gray-400 mt-2 flex-1">
              Professionally printed, room-labeled waterproof QR cards delivered to the property.
            </p>
            <Link
              href={`/properties/${slug}/qr-kit/order`}
              className="mt-6 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg px-4 py-3 text-center"
            >
              Review and order · $39
            </Link>
          </section>
        </div>

        <div className="mt-6 border border-gray-800 rounded-xl p-4 bg-gray-950 flex items-start gap-3">
          <span className="text-green-400" aria-hidden="true">✓</span>
          <p className="text-sm text-gray-300">
            Every format uses this property&apos;s unique zone links. After printing, scan one code with your phone to test it before installation.
          </p>
        </div>
      </main>
    </div>
  );
}
