import Link from "next/link";
import { redirect } from "next/navigation";
import AppNav from "@/app/components/AppNav";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";

export default async function KitOrderSuccessPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userId = user.id;

  let confirmed = false;
  let propertyName = "your property";
  let orderNumber = "";
  if (query.session_id) {
    try {
      const session = await createStripeClient().checkout.sessions.retrieve(query.session_id);
      confirmed = session.metadata?.host_id === userId && session.metadata?.purchase_type === "waterproof_qr_kit" && session.payment_status === "paid";
      propertyName = session.metadata?.property_name || propertyName;
      orderNumber = session.id.slice(-8).toUpperCase();
    } catch (error) {
      console.error("Failed to confirm QR kit order", error);
    }
  }

  return (
    <div><AppNav current="/dashboard" /><main className="max-w-2xl mx-auto p-6 sm:py-16 text-center">
      <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl ${confirmed ? "bg-green-950 text-green-300" : "bg-amber-950 text-amber-300"}`}>{confirmed ? "✓" : "!"}</div>
      <h1 className="text-3xl font-semibold mt-5">{confirmed ? "Your QR Kit is ordered" : "We’re confirming your payment"}</h1>
      <p className="text-sm text-muted mt-3">{confirmed ? `We received the waterproof QR Kit order for ${propertyName}. We’ll email you when it ships.` : "Your order status may take a moment to update. Please keep this page for your records."}</p>
      {orderNumber && <p className="text-xs text-gray-500 mt-3">Order reference: {orderNumber}</p>}
      <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
        <Link href={`/properties/${slug}`} className="bg-green-600 hover:bg-green-500 text-white rounded-lg px-5 py-3 text-sm font-medium">Return to property</Link>
        <Link href={`/properties/${slug}/qr-kit`} className="border border-gray-700 rounded-lg px-5 py-3 text-sm font-medium">View QR Kit options</Link>
      </div>
    </main></div>
  );
}
