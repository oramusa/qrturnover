# Stripe Subscription Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let hosts subscribe to a $7/mo plan from the dashboard, manage/cancel via Stripe's hosted portal, and see their trial/subscription status — no access gating.

**Architecture:** The Stripe Checkout session creation route and the webhook handler that syncs `hosts.subscription_status` already exist and are correct as-is. This plan adds one new API route (`/api/stripe/portal`) and one new dashboard UI component, plus the real Stripe credentials needed to make the existing routes actually work.

**Tech Stack:** Next.js 16 App Router, `stripe` npm package (already installed, v22), Supabase (`hosts` table already has `stripe_customer_id`/`subscription_status`/`trial_ends_at` columns).

## Global Constraints

- Follow the design in `docs/superpowers/specs/2026-08-15-stripe-billing-design.md`.
- No access gating — `subscription_status`/`trial_ends_at` are informational only on the dashboard, nothing in `middleware.ts` or elsewhere should block functionality based on them.
- Price is fixed at $7/mo, one tier, no code should hardcode a different amount — the price itself lives in Stripe (`STRIPE_PRICE_ID` env var); the dashboard display of "$7/mo" is just copy text, not derived from a Stripe API call (avoids an extra API round-trip for a fixed, known price).
- Both new/touched call sites (`/api/stripe/portal`, the billing card's fetch calls) must check for errors and surface them to the user, not fail silently — this codebase has had exactly this class of bug before (swallowed Supabase/fetch errors), caught in a prior feature's code review.
- Redirects to Stripe (Checkout, portal) use a full-page `window.location.href` navigation, not a client-side route change — matches how Stripe's hosted pages are meant to be reached.
- **No test framework exists in this codebase.** Verification uses `npx tsc --noEmit`, direct curl calls to Stripe's API (using the real test-mode secret key) and to the running dev server's routes.
- Dev server runs via `npm run dev -- -p 3002` in `/Users/alpaytonga/Desktop/turnover-app`. `.env.local` needs `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` populated (currently blank) as part of Task 1.

---

## Task 1: Obtain Stripe credentials (controller-led, not a subagent dispatch)

This task requires live interaction with the human partner (creating a product in the Stripe dashboard, running the Stripe CLI's interactive login) — it cannot be delegated to an isolated subagent with no conversation context. The controller (you, running this plan) performs this task directly by coordinating with the human partner in the main session, the same way an earlier plan's schema migration required the human to paste SQL into a dashboard.

**Files:** `.env.local` (not committed to git — already `.gitignore`d).

- [ ] **Step 1: Guide the human partner to create the Stripe product/price**

Ask them to, in their Stripe dashboard (test mode): create a Product named "QRTurnover" with a recurring Price of $7.00/month. Ask them to paste back: the Price's id (starts `price_...`) and their test-mode Secret key (Developers > API keys, starts `sk_test_...`).

- [ ] **Step 2: Write the two known values into `.env.local`**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
```

Update `STRIPE_SECRET_KEY=<value>` and `STRIPE_PRICE_ID=<value>` in `.env.local` (use the Edit tool — read the file first, it already has blank placeholders for both keys at the lines shown in `.env.local.example`).

- [ ] **Step 3: Verify the secret key and price id are valid, directly against Stripe's API**

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
curl -s "https://api.stripe.com/v1/prices/$STRIPE_PRICE_ID" \
  -u "$STRIPE_SECRET_KEY:" -w "\nstatus:%{http_code}\n"
```

Expected: `status:200` and a JSON body with `"unit_amount":700` and `"recurring":{"interval":"month",...}`. If `unit_amount` isn't `700`, tell the human the price doesn't match $7/mo and ask them to confirm which price to use.

- [ ] **Step 4: Set up local webhook forwarding with the human partner**

Ask them to run (in their own terminal, since it needs to stay running and may prompt an interactive browser login the assistant cannot complete):

```bash
stripe login   # only if not already logged in — opens a browser
stripe listen --forward-to localhost:3002/api/stripe/webhook
```

Ask them to paste back the printed webhook signing secret (starts `whsec_...`). Write it into `STRIPE_WEBHOOK_SECRET` in `.env.local`. Tell them to leave that `stripe listen` command running in its own terminal for the rest of this work (it forwards real Stripe events to the local dev server).

- [ ] **Step 5: Confirm all three env vars are present**

```bash
grep -E "STRIPE_SECRET_KEY|STRIPE_PRICE_ID|STRIPE_WEBHOOK_SECRET" /Users/alpaytonga/Desktop/turnover-app/.env.local
```

Expected: all three lines show non-empty values (don't print the actual secret values back to the human unnecessarily beyond this local confirmation — they already know them, they just gave them to you).

No commit for this task (env file is git-ignored).

---

## Task 2: `/api/stripe/portal` route

**Files:**
- Create: `app/api/stripe/portal/route.ts`

**Interfaces:**
- Consumes: `hosts.stripe_customer_id` (already exists in schema, populated by the existing webhook on `checkout.session.completed`).
- Produces: `POST /api/stripe/portal` → `{ url: string }` on success, or `{ error: string }` with a non-200 status on failure. Task 3's billing card calls this exactly like it calls the existing `/api/stripe/checkout`.

- [ ] **Step 1: Read the existing checkout route for the pattern to mirror**

Read `app/api/stripe/checkout/route.ts` in full — this task's route follows its auth/error-handling shape exactly (create a `Stripe` client at module scope with `STRIPE_SECRET_KEY`, get the logged-in user via `createClient()` from `@/lib/supabase/server`, return 401 JSON if not logged in).

- [ ] **Step 2: Write `app/api/stripe/portal/route.ts`**

```tsx
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

  const { data: host } = await supabase
    .from("hosts")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

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
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
npx tsc --noEmit
```

Expected: no errors in `app/api/stripe/portal/route.ts`.

- [ ] **Step 4: Verify the "no customer yet" error path against the running dev server**

The dev server must be running (`npm run dev -- -p 3002` — check with `lsof -ti:3002`, start it if not running, `sleep 3` after starting). This route requires a logged-in session cookie, which curl can't easily provide without a real browser login — but you can verify the unauthenticated-rejection path directly, which exercises the same auth-check code path as the real one just without a session:

```bash
curl -s -i -X POST http://localhost:3002/api/stripe/portal
```

Expected: `HTTP/1.1 401` (or a redirect if middleware intercepts first — check which) with `{"error":"Not logged in"}` if middleware doesn't intercept. Note in your report which behavior you observed (this route isn't in `middleware.ts`'s `protectedPaths`, so it likely reaches the route handler directly and returns the 401 JSON — confirm this rather than assuming).

- [ ] **Step 5: Verify the Stripe API call shape is valid (without a real customer) by checking the Stripe API directly**

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
# Confirm the billing portal API is reachable and the secret key has access to it
# (a bare call with no customer should fail with a specific "missing customer" error,
# not an auth/permissions error — confirms the key itself is valid for this API):
curl -s -X POST "https://api.stripe.com/v1/billing_portal/sessions" \
  -u "$STRIPE_SECRET_KEY:" -w "\nstatus:%{http_code}\n"
```

Expected: `status:400` with an error message about a missing/required `customer` parameter (not a `401`/`403` about invalid API key — that would mean `STRIPE_SECRET_KEY` itself is bad, stop and re-check Task 1 if you see that).

- [ ] **Step 6: Commit**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
git add app/api/stripe/portal/route.ts
git commit -m "$(cat <<'EOF'
feat: add Stripe billing portal session route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Dashboard billing card

**Files:**
- Create: `app/dashboard/BillingCard.tsx`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `/api/stripe/checkout` (existing, returns `{url}`), `/api/stripe/portal` (Task 2, returns `{url}` or `{error}`), `hosts.subscription_status` / `hosts.trial_ends_at` columns.
- Produces: `<BillingCard subscriptionStatus={...} trialEndsAt={...} />` rendered at the top of `/dashboard`. No other task depends on this.

- [ ] **Step 1: Write `app/dashboard/BillingCard.tsx`**

```tsx
"use client";

import { useState } from "react";

function daysUntil(dateString: string) {
  const ms = new Date(dateString).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function BillingCard({
  subscriptionStatus,
  trialEndsAt,
}: {
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redirectTo(path: string) {
    setLoading(true);
    setError(null);
    const res = await fetch(path, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(body.error || "Something went wrong. Please try again.");
      return;
    }
    window.location.href = body.url;
  }

  const isActive = subscriptionStatus === "active";
  const needsAttention =
    subscriptionStatus === "past_due" || subscriptionStatus === "canceled";

  return (
    <div className="border rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
      <div>
        {isActive && <p className="text-sm font-medium">Subscribed — $7/mo</p>}
        {subscriptionStatus === "trialing" && trialEndsAt && (
          <p className="text-sm font-medium">
            Trial ends in {daysUntil(trialEndsAt)} day{daysUntil(trialEndsAt) === 1 ? "" : "s"} — $7/mo after
          </p>
        )}
        {needsAttention && (
          <p className="text-sm font-medium text-amber-700">
            {subscriptionStatus === "past_due"
              ? "Payment issue — please update your billing."
              : "Subscription canceled."}
          </p>
        )}
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
      </div>
      <button
        onClick={() => redirectTo(isActive ? "/api/stripe/portal" : "/api/stripe/checkout")}
        disabled={loading}
        className="text-sm border rounded px-3 py-2 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 shrink-0"
      >
        {loading ? "Loading..." : isActive ? "Manage subscription" : "Subscribe"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `app/dashboard/page.tsx`**

The current file's data-fetching section is:

```tsx
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: properties } = await supabase
```

Change it to also fetch the host's billing fields:

```tsx
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: host } = await supabase
    .from("hosts")
    .select("subscription_status, trial_ends_at")
    .eq("id", user!.id)
    .single();

  const { data: properties } = await supabase
```

Add the import:

```tsx
import BillingCard from "./BillingCard";
```

The current render currently starts with:

```tsx
      <NewPropertyForm />
```

Add the card immediately before it:

```tsx
      <BillingCard
        subscriptionStatus={host?.subscription_status ?? null}
        trialEndsAt={host?.trial_ends_at ?? null}
      />

      <NewPropertyForm />
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
npx tsc --noEmit
```

Expected: no errors in `BillingCard.tsx` or `page.tsx`.

- [ ] **Step 4: Verify checkout redirect end-to-end using a real (disposable) logged-in session**

Since this needs a real browser session (Supabase auth cookies aren't easily faked via curl for a full Checkout redirect test), verify the two building blocks separately instead:

(a) Confirm `/api/stripe/checkout` (existing route, unchanged) actually returns a real Stripe-hosted URL when called with a valid session — sign up a disposable throwaway host via Supabase auth signup (email confirmation is disabled on this project, so you get a session/access_token immediately), then hit the checkout route with that session's cookie. The simplest way to get a real cookie-bearing request without a browser: use the access token as a Bearer token isn't enough for `@supabase/ssr`'s cookie-based session reading in the route handler — so instead, verify this component-level: read `app/api/stripe/checkout/route.ts` again and confirm its logic is unchanged and was already working before this task (it was not modified by Task 2 or Task 3). This task doesn't touch that route, so its correctness is already established; your job is just to confirm `BillingCard.tsx` calls it with the right method/path.

(b) Directly confirm `BillingCard.tsx`'s fetch calls target the exact right paths and HTTP method by reading the component's source (grep for `fetch\(` — but there is no `fetch(` call, it's `fetch(path` via `redirectTo` — confirm both call sites pass `"/api/stripe/checkout"` and `"/api/stripe/portal"` respectively, both as `POST`).

(c) Confirm the day-count logic: pick a date 5 days in the future, run this to confirm `daysUntil` would compute correctly (reproduce the function's logic in a one-off node command):

```bash
node -e "
const d = new Date(Date.now() + 5*24*60*60*1000).toISOString();
const ms = new Date(d).getTime() - Date.now();
console.log(Math.max(0, Math.ceil(ms / (1000*60*60*24))));
"
```

Expected: prints `5` (or `6` if run right at a day boundary — either is fine, confirms the rounding-up behavior is sane, not confirming an exact value).

- [ ] **Step 5: Manually confirm in-browser**

Log in as your real host account on `/dashboard`, confirm the billing card renders with "Trial ends in N days — $7/mo after" and a "Subscribe" button (since your account should currently be `trialing` per the schema default). Click "Subscribe" and confirm it redirects to a real Stripe Checkout page showing $7.00/month. You don't need to complete a real test payment unless you want to (Stripe test mode supports card number `4242 4242 4242 4242` with any future expiry/CVC) — but if you do, confirm afterward that `hosts.subscription_status` updated to `active` (the `stripe listen` terminal from Task 1 should show the webhook events arriving) and that reloading `/dashboard` now shows "Subscribed — $7/mo" with a "Manage subscription" button.

- [ ] **Step 6: Commit**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
git add app/dashboard/BillingCard.tsx app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat: add dashboard billing card (subscribe / manage subscription)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
