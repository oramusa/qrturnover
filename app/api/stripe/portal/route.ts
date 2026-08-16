import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Creates a Stripe billing portal session so an already-subscribed host can
// update their payment method or cancel, without building custom UI for it.
// Wire a "Manage subscription" button on the dashboard to POST here.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { data: host, error } = await supabase
    .from("hosts")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  if (!host?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No subscription found for this account yet." },
      { status: 400 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: host.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
