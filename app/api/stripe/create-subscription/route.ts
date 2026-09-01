import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Creates (or reuses) the host's Stripe customer and an incomplete
// subscription, returning the PaymentIntent client secret for our own
// PaymentElement-based form to confirm — no Stripe-hosted Checkout page.
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
    console.error("Failed to look up host for subscription", error);
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 500 }
    );
  }

  try {
    let customerId = host?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
      await supabase.from("hosts").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env.STRIPE_PRICE_ID! }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      // Recent Stripe API versions moved the client secret from
      // latest_invoice.payment_intent to latest_invoice.confirmation_secret —
      // expand both and use whichever the account's pinned version returns.
      expand: ["latest_invoice.payment_intent", "latest_invoice.confirmation_secret"],
      metadata: { host_id: user.id },
    });

    const invoice = subscription.latest_invoice as
      | (Stripe.Invoice & {
          payment_intent?: Stripe.PaymentIntent | string | null;
          confirmation_secret?: { client_secret: string } | null;
        })
      | null;

    const clientSecret =
      (typeof invoice?.payment_intent === "object" ? invoice.payment_intent?.client_secret : undefined) ??
      invoice?.confirmation_secret?.client_secret;

    if (!clientSecret) {
      console.error("Subscription created but no client secret found on invoice", invoice);
      return NextResponse.json(
        { error: "Couldn't start checkout — no payment step was returned. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ clientSecret });
  } catch (err) {
    console.error("Failed to create subscription", err);
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : err instanceof Error
          ? `Unexpected error: ${err.message}`
          : "Couldn't start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
