import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Creates an embedded Stripe Checkout session for the logged-in host to start
// their subscription. Embedded (vs. hosted) mode keeps the payment form on
// our own page instead of redirecting to a stripe.com URL — the client
// mounts it via the returned client_secret and @stripe/stripe-js.
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
    console.error("Failed to look up host for checkout session", error);
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 500 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      ...(host?.stripe_customer_id
        ? { customer: host.stripe_customer_id }
        : { customer_email: user.email }),
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?checkout=success`,
      metadata: { host_id: user.id },
    });

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error("Failed to create checkout session", err);
    const message = err instanceof Stripe.errors.StripeError ? err.message : "Couldn't start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
