import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";
import { calculateQrKitPrice, MAX_QR_KIT_PROPERTIES } from "@/lib/qrKitPricing";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const propertyIds: string[] = Array.isArray(body?.propertyIds)
    ? [...new Set<string>(body.propertyIds.filter((id: unknown): id is string => typeof id === "string"))]
    : [];
  if (propertyIds.length < 1 || propertyIds.length > MAX_QR_KIT_PROPERTIES) {
    return NextResponse.json({ error: `Choose between 1 and ${MAX_QR_KIT_PROPERTIES} properties.` }, { status: 400 });
  }

  const [{ data: properties }, { data: host }] = await Promise.all([
    supabase.from("properties").select("id, name, slug").in("id", propertyIds).eq("host_id", user.id),
    supabase.from("hosts").select("stripe_customer_id").eq("id", user.id).single(),
  ]);

  if (!properties || properties.length !== propertyIds.length) return NextResponse.json({ error: "One or more properties could not be found." }, { status: 404 });
  const propertyMap = new Map(properties.map((property) => [property.id, property]));
  const orderedProperties = propertyIds.map((id) => propertyMap.get(id)!);
  const { data: claims } = await supabase
    .from("property_set_claims")
    .select("property_id, set_id")
    .in("property_id", propertyIds)
    .is("released_at", null);
  const setIds = (claims ?? []).map((claim) => claim.set_id);
  const { data: zones } = setIds.length > 0
    ? await supabase
        .from("qr_set_zones")
        .select("set_id")
        .in("set_id", setIds)
    : { data: [] as { set_id: string }[] };
  const propertyBySet = new Map((claims ?? []).map((claim) => [claim.set_id, claim.property_id]));
  const zoneCountByProperty = new Map<string, number>();
  for (const zone of zones ?? []) {
    const propertyId = propertyBySet.get(zone.set_id);
    if (propertyId) zoneCountByProperty.set(propertyId, (zoneCountByProperty.get(propertyId) ?? 0) + 1);
  }
  if (propertyIds.some((id) => !zoneCountByProperty.get(id))) {
    return NextResponse.json({ error: "Every selected property needs at least one room." }, { status: 400 });
  }
  const zoneCount = propertyIds.reduce((total, id) => total + (zoneCountByProperty.get(id) ?? 0), 0);
  const totalCents = calculateQrKitPrice(propertyIds.length);
  const primaryProperty = orderedProperties[0];

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
          unit_amount: totalCents,
          product_data: {
            name: `Waterproof QR Kits — ${propertyIds.length} ${propertyIds.length === 1 ? "property" : "properties"}`,
            description: `${zoneCount} room-labeled waterproof QR card${zoneCount === 1 ? "" : "s"} in one shipment, US shipping included`,
          },
        },
      }],
      shipping_address_collection: { allowed_countries: ["US"] },
      phone_number_collection: { enabled: true },
      success_url: `${appUrl}/properties/${primaryProperty.slug}/qr-kit/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/properties/${primaryProperty.slug}/qr-kit/order`,
      metadata: {
        purchase_type: "waterproof_qr_kit",
        host_id: user.id,
        property_id: primaryProperty.id,
        property_ids: propertyIds.join(","),
        property_slug: primaryProperty.slug,
        property_name: primaryProperty.name,
        property_count: String(propertyIds.length),
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
