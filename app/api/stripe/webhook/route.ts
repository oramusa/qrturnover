import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";

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
