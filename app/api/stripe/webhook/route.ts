import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { QR_KIT_ADDITIONAL_PROPERTY_CENTS, QR_KIT_FIRST_PROPERTY_CENTS } from "@/lib/qrKitPricing";

// Point your Stripe webhook (checkout.session.completed, customer.subscription.updated/
// deleted) at {your domain}/api/stripe/webhook and paste the signing secret into
// STRIPE_WEBHOOK_SECRET. This keeps hosts.subscription_status in sync with Stripe
// so you can gate dashboard access on it.
export async function POST(req: NextRequest) {
  const stripe = createStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: `Webhook signature verification failed` }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const hostId = session.metadata?.host_id;
      if (session.metadata?.purchase_type === "waterproof_qr_kit") {
        const propertyIds = (session.metadata.property_ids ?? session.metadata.property_id ?? "")
          .split(",")
          .filter(Boolean);
        if (!hostId || propertyIds.length === 0) {
          console.error("Waterproof QR kit checkout is missing ownership metadata", session.id);
          break;
        }
        const { data: existingOrder } = await supabase
          .from("qr_kit_orders")
          .select("payment_status")
          .eq("stripe_session_id", session.id)
          .maybeSingle();

        const [{ data: properties }, { data: claims }] = await Promise.all([
          supabase.from("properties").select("id, name").in("id", propertyIds).eq("host_id", hostId),
          supabase.from("property_set_claims").select("property_id, set_id").in("property_id", propertyIds).is("released_at", null),
        ]);
        const setIds = (claims ?? []).map((claim) => claim.set_id);
        const { data: zones } = setIds.length > 0
          ? await supabase.from("qr_set_zones").select("set_id").in("set_id", setIds)
          : { data: [] as { set_id: string }[] };
        const propertyBySet = new Map((claims ?? []).map((claim) => [claim.set_id, claim.property_id]));
        const zoneCountByProperty = new Map<string, number>();
        for (const zone of zones ?? []) {
          const propertyId = propertyBySet.get(zone.set_id);
          if (propertyId) zoneCountByProperty.set(propertyId, (zoneCountByProperty.get(propertyId) ?? 0) + 1);
        }
        const nameByProperty = new Map((properties ?? []).map((property) => [property.id, property.name]));
        const orderProperties = propertyIds.map((propertyId, index) => ({
          propertyId,
          propertyName: nameByProperty.get(propertyId) ?? (index === 0 ? session.metadata?.property_name : null) ?? "Property",
          zoneCount: zoneCountByProperty.get(propertyId) ?? 0,
          unitAmountCents: index === 0 ? QR_KIT_FIRST_PROPERTY_CENTS : QR_KIT_ADDITIONAL_PROPERTY_CENTS,
        }));

        const shipping = session.collected_information?.shipping_details;
        const address = shipping?.address;
        const { data: savedOrder, error: orderError } = await supabase.from("qr_kit_orders").upsert({
          host_id: hostId,
          property_id: propertyIds[0],
          stripe_session_id: session.id,
          amount_cents: session.amount_total ?? QR_KIT_FIRST_PROPERTY_CENTS,
          currency: session.currency ?? "usd",
          payment_status: session.payment_status,
          fulfillment_status: "new",
          zone_count: Number(session.metadata.zone_count ?? 0),
          shipping_name: shipping?.name ?? session.customer_details?.name,
          shipping_phone: session.customer_details?.phone,
          shipping_address_line1: address?.line1,
          shipping_address_line2: address?.line2,
          shipping_city: address?.city,
          shipping_state: address?.state,
          shipping_postal_code: address?.postal_code,
          shipping_country: address?.country,
        }, { onConflict: "stripe_session_id" }).select("id").single();

        if (orderError) {
          console.error("Failed to save waterproof QR kit order", orderError);
          break;
        }

        const { error: orderPropertiesError } = await supabase.from("qr_kit_order_properties").upsert(
          orderProperties.map((property, index) => ({
            order_id: savedOrder.id,
            property_id: property.propertyId,
            property_name: property.propertyName,
            zone_count: property.zoneCount,
            unit_amount_cents: property.unitAmountCents,
            sort_order: index,
          })),
          { onConflict: "order_id,property_id" },
        );
        if (orderPropertiesError) {
          console.error("Failed to save QR kit order properties", orderPropertiesError);
          break;
        }

        if (existingOrder?.payment_status !== "paid" && session.payment_status === "paid") {
          const propertyLabel = orderProperties.length === 1
            ? orderProperties[0].propertyName
            : `${orderProperties.length} properties`;
          const propertyList = orderProperties
            .map((property) => `- ${property.propertyName}: ${property.zoneCount} room${property.zoneCount === 1 ? "" : "s"}`)
            .join("\n");
          const orderReference = session.id.slice(-8).toUpperCase();
          const shippingText = [
            shipping?.name,
            address?.line1,
            address?.line2,
            [address?.city, address?.state, address?.postal_code].filter(Boolean).join(", "),
            address?.country,
          ].filter(Boolean).join("\n");

          await Promise.all([
            session.customer_details?.email ? sendEmail({
              to: session.customer_details.email,
              subject: `QR Kit order confirmed — ${propertyLabel}`,
              text: `Thanks! Your waterproof QR Kit order is confirmed.\n\n${propertyList}\n\nTotal cards: ${session.metadata.zone_count}\nOrder reference: ${orderReference}\n\nDelivery address:\n${shippingText}\n\nWe’ll email you when your kit ships.`,
            }) : Promise.resolve(),
            sendEmail({
              to: process.env.ADMIN_NOTIFICATION_EMAIL || "admin@qrturnover.com",
              subject: `New waterproof QR Kit order — ${propertyLabel}`,
              text: `A paid QR Kit order is ready to fulfill.\n\n${propertyList}\n\nTotal cards: ${session.metadata.zone_count}\nStripe session: ${session.id}\nAmount: $${((session.amount_total ?? 0) / 100).toFixed(2)}\n\nShip to:\n${shippingText}`,
            }),
          ]);
        }
        break;
      }

      if (hostId) {
        await supabase
          .from("hosts")
          .update({
            stripe_customer_id: session.customer as string,
            subscription_status: "active",
          })
          .eq("id", hostId);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("hosts")
        .update({ subscription_status: subscription.status })
        .eq("stripe_customer_id", subscription.customer as string);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
