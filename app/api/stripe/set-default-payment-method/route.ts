import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";

// Called after the client confirms a SetupIntent via the Payment Element —
// makes that payment method the default for future invoices/renewals.
export async function POST(req: NextRequest) {
  const stripe = createStripeClient();
  const { paymentMethodId } = await req.json();
  if (!paymentMethodId || typeof paymentMethodId !== "string") {
    return NextResponse.json({ error: "Missing paymentMethodId" }, { status: 400 });
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

  if (!host?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
  }

  // Confirm the payment method actually belongs to this host's customer
  // before touching anything — a forged/guessed ID must never let one host
  // change another's billing.
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (paymentMethod.customer !== host.stripe_customer_id) {
    return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
  }

  await stripe.customers.update(host.stripe_customer_id, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const subscriptions = await stripe.subscriptions.list({
    customer: host.stripe_customer_id,
    status: "all",
    limit: 1,
  });
  if (subscriptions.data[0]) {
    await stripe.subscriptions.update(subscriptions.data[0].id, {
      default_payment_method: paymentMethodId,
    });
  }

  return NextResponse.json({ ok: true });
}
