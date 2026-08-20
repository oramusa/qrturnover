import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Creates a SetupIntent so the host can add/replace a card via the embedded
// Payment Element on /account/billing, without leaving the app.
export async function POST() {
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

  if (!host?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account yet — subscribe first." }, { status: 400 });
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: host.stripe_customer_id,
    payment_method_types: ["card"],
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}
