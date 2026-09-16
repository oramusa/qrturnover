import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.propertyId || typeof body.propertyId !== "string") {
    return NextResponse.json({ error: "Choose a property first." }, { status: 400 });
  }

  const [{ data: property }, { data: host }] = await Promise.all([
    supabase.from("properties").select("id, name, slug").eq("id", body.propertyId).eq("host_id", user.id).single(),
    supabase.from("hosts").select("stripe_customer_id").eq("id", user.id).single(),
  ]);

  if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });
  const { data: claim } = await supabase
    .from("property_set_claims")
    .select("set_id")
    .eq("property_id", property.id)
    .is("released_at", null)
    .maybeSingle();
  const { count } = claim
    ? await supabase
        .from("qr_set_zones")
        .select("zone_slug", { count: "exact", head: true })
        .eq("set_id", claim.set_id)
    : { count: 0 };
  const zoneCount = count ?? 0;
  if (zoneCount === 0) return NextResponse.json({ error: "Add at least one room before ordering." }, { status: 400 });

  try {
    const stripe = createStripeClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ...(host?.stripe_customer_id ? { customer: host.stripe_customer_id } : { customer_email: user.email }),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 3900,
          product_data: {
            name: `Waterproof QR Kit — ${property.name}`,
            description: `${zoneCount} room-labeled waterproof QR card${zoneCount === 1 ? "" : "s"}, US shipping included`,
          },
        },
      }],
      shipping_address_collection: { allowed_countries: ["US"] },
      phone_number_collection: { enabled: true },
      success_url: `${appUrl}/properties/${property.slug}/qr-kit/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/properties/${property.slug}/qr-kit/order`,
      metadata: {
        purchase_type: "waterproof_qr_kit",
        host_id: user.id,
        property_id: property.id,
        property_slug: property.slug,
        property_name: property.name,
        zone_count: String(zoneCount),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create waterproof kit checkout", error);
    const message = error instanceof Stripe.errors.StripeError ? error.message : "Couldn't start checkout. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
