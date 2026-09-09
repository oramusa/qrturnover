import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";

// Toggles cancel-at-period-end on the host's subscription — cancelling
// keeps access through the end of the current billing period rather than
// cutting it off immediately; resume just flips it back.
export async function POST(req: NextRequest) {
  const stripe = createStripeClient();
  const { subscriptionId, resume } = await req.json();
  if (!subscriptionId || typeof subscriptionId !== "string") {
    return NextResponse.json({ error: "Missing subscriptionId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (!host?.stripe_customer_id || subscription.customer !== host.stripe_customer_id) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: !resume });

  return NextResponse.json({ ok: true });
}
