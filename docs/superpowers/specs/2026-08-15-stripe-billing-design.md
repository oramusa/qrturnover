# Stripe subscription billing

## Problem

Hosts get a 14-day trial (`hosts.trial_ends_at`, set at signup) but have no way to actually subscribe. The backend scaffold for this already exists — `/api/stripe/checkout` creates a Checkout session, `/api/stripe/webhook` syncs `hosts.subscription_status` — but it's unwired: no real Stripe credentials, no "Subscribe" button anywhere, and no way for a subscribed host to manage or cancel their subscription.

## Goals

- Hosts can subscribe to a $7/mo plan from the dashboard.
- Subscribed hosts can self-serve manage payment method / cancel via Stripe's hosted billing portal.
- The dashboard shows current billing state: trial countdown with price, active subscription with a manage link, or past-due/canceled with a re-subscribe prompt.
- Local development can receive real Stripe webhook events (via Stripe CLI forwarding) so `subscription_status` updates are testable before deploying.

## Non-goals

- No access gating: trial expiry or a lapsed subscription does not block any dashboard functionality. `subscription_status` is informational only for now.
- No plan tiers, seats, or usage-based billing — a single fixed $7/mo price.
- No changes to signup/trial-start logic (`trial_ends_at` is already set at signup via `hosts` table default).

## External setup (not code — done directly in the Stripe/Supabase dashboards)

1. In the Stripe dashboard (test mode to start), create a Product ("QRTurnover") with a recurring Price: $7/mo.
2. Copy the Secret key (test mode) into `STRIPE_SECRET_KEY`, and the new Price's id into `STRIPE_PRICE_ID` in `.env.local`.
3. For local webhook testing, install/run the Stripe CLI: `stripe listen --forward-to localhost:3002/api/stripe/webhook` — this prints a webhook signing secret, which goes into `STRIPE_WEBHOOK_SECRET`.
4. Before going live, repeat steps 1-2 in live mode and add a real webhook endpoint (`https://<domain>/api/stripe/webhook`) in the Stripe dashboard's Webhooks settings, subscribed to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` (matching what `/api/stripe/webhook` already handles).

## Backend

`/api/stripe/checkout` and `/api/stripe/webhook` are already implemented correctly and need no code changes — just the env vars above.

**New: `POST /api/stripe/portal`** — mirrors `/api/stripe/checkout`'s auth pattern (logged-in host via `createClient()`/`getUser()`). Looks up the host's `stripe_customer_id` from the `hosts` table; if missing (never subscribed), returns a 400 with a clear error. Otherwise creates a `stripe.billingPortal.sessions.create({ customer: stripe_customer_id, return_url: `${NEXT_PUBLIC_APP_URL}/dashboard` })` and returns `{ url: session.url }`, same response shape as the checkout route.

## Frontend

**New client component, rendered at the top of `/dashboard`** (above the property list, below the header row): reads `subscription_status` and `trial_ends_at` from the already-logged-in host's row (fetched server-side in `dashboard/page.tsx`, passed as props — no new client-side Supabase query needed, following the existing pattern of server-fetched data passed to client components for interactivity).

Renders one of three states:
- **`trialing`**: "Trial ends in N days — $7/mo after" (N computed from `trial_ends_at`) + a "Subscribe" button. Button POSTs to `/api/stripe/checkout`, then `window.location.href = url` from the response (matches how Stripe Checkout redirects are normally handled — full navigation, not a fetch-and-render).
- **`active`**: "Subscribed — $7/mo" + a "Manage subscription" button, same POST-then-redirect pattern against `/api/stripe/portal`.
- **`past_due` or `canceled`**: a small amber warning ("Payment issue — please update your billing" / "Subscription canceled") + a "Subscribe" button (same as the trialing case, re-subscribing).

No polling or auto-refresh needed here — the webhook keeps `hosts.subscription_status` current in the DB, and a normal page load/refresh picks up the latest value (consistent with how the rest of the dashboard already works, e.g. `AutoRefresh` is only used on the property page where near-real-time matters).

## Error handling

- `/api/stripe/checkout` and `/api/stripe/portal` both already/will return a JSON error body on failure (missing user, missing customer id, Stripe API error) — the billing card component checks the response and shows an inline error message rather than silently failing to redirect (this codebase has had exactly this class of bug before — silently swallowed errors — so both new/touched call sites explicitly check and surface them).
- Webhook signature verification failure (`/api/stripe/webhook`) already returns 400, unchanged.

## Out of scope / follow-ups not included here

- Access gating on trial/subscription expiry (explicitly deferred per this conversation).
- Live-mode cutover (switching keys from test to live) — noted in External Setup step 4 but not performed as part of this work; happens at actual launch time.
- Multiple pricing tiers or annual billing.
