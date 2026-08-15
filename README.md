# QRTurnover (working name)

MVP scaffold: multi-property cleaning verification for STR hosts. Cleaners scan a
unique QR code at each zone (kitchen, bathroom, fridge...) to mark it done — no app,
no login. Hosts see live, per-zone status across every property.

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth + Storage)
- Stripe (subscription billing)
- `qrcode` for QR generation

## What's built

| Feature | Status |
|---|---|
| Host signup/login (Supabase Auth) | Done |
| Multi-property dashboard | Done |
| Zone CRUD per property | Done |
| Printable QR sheet (one code per zone) | Done |
| Start / complete a turnover session | Done |
| Public cleaner scan page (no login) + photo upload | Done |
| Live per-zone status on property page | Done |
| Stripe Checkout session creation | Done (needs your Stripe keys + price) |
| Stripe webhook to sync subscription status | Done (needs webhook secret) |
| Gating dashboard access on subscription_status | Not wired yet — add a check once ready to enforce billing |
| Physical sticker printing/mailing service | Phase 2, not started |
| PWA (installable, works offline for static shell) | Done — manifest, icons, service worker |
| Cleaner accounts/identity (access-code login, per-cleaner attribution) | Done |
| Assign specific cleaners to specific properties | Done |
| Time tracking (start job / finish job, duration shown to host) | Done |
| Real-time email notifications to host (job started, zone scanned, job finished) | Done (needs a Resend API key) |
| Turnover history with cleaner name + duration | Done |
| Per-zone checklist text + required (not just optional) photos | Done |
| Host can view/browse cleaner-submitted photos per zone | Done |

## Cleaner identity, time tracking & notifications — how it works

- **No cleaner passwords.** Each cleaner gets a short 5-character access code
  (generated on the "Cleaners" page). They enter it once per device, the first time
  they scan any QR code for that host — after that, a cookie remembers them for ~90
  days.
- **Assign cleaners to properties** from a property's page ("Assigned cleaners"
  section) — a cleaner only needs to be assigned once, then every future turnover at
  that property recognizes them.
- **Job timing**: on their first zone scan of a turnover, the cleaner sees a "Start
  job" button; when finished, "Finish job" marks the whole turnover complete and
  records total duration. The host sees this duration on the property page's
  turnover history.
- **Notifications**: the host's email gets a message when a cleaner starts a job,
  when each zone is scanned, and when the job finishes (with duration). This uses
  Resend (resend.com) — without an API key set, notifications just log to the server
  console instead of failing anything, so the app works fine without it configured.
- **Known limitation (documented, not hidden)**: the cleaner's identity cookie is not
  cryptographically signed — it stores the cleaner's ID directly. Someone could
  theoretically forge it to misattribute a scan to the wrong cleaner, but they'd need
  a valid cleaner ID for that host first (via a valid access code), and the worst case
  is a wrongly-attributed cleaning record, not access to any host data. Fine for v1;
  worth revisiting (e.g. signed JWT-style cookie) before this scales to properties
  where that misattribution risk actually matters to hosts.

## Photo verification (checklists + required photos)

- When adding a zone, the host can optionally add a **checklist** (one item per
  line — e.g. "Toilet paper stocked", "No hair in drain") shown to the cleaner right
  on the scan page, and/or toggle **"Require a photo before this zone can be marked
  done."**
- If a zone requires a photo, the cleaner physically cannot submit "done" without
  attaching one — enforced both in the UI and again server-side in `/api/scan` (so a
  direct API call can't bypass it either).
- Hosts see photo thumbnails two places: inline next to the zone during an active
  turnover, and as a browsable strip under each entry in turnover history — click any
  thumbnail to open it full-size.
- This is intentionally simple for v1: no AI-based "does this photo actually show a
  stocked fridge" verification — it's proof that *a* photo was taken at that zone,
  which the host reviews themselves. Automated photo verification would be a
  meaningful phase-2/3 upgrade, not a v1 scope item.

## PWA — "installing" the app

There's no native iOS/Android app, and you don't need one for v1 — see the
reasoning in-chat. Instead, this is a installable web app:

- On Android (Chrome), visiting the site shows an "Install app" prompt, or the user
  can tap the browser menu → "Add to Home Screen". It then opens full-screen with its
  own icon, no browser chrome.
- On iOS (Safari), there's no automatic prompt — the user taps Share → "Add to Home
  Screen" manually. This is an Apple platform limitation, not something fixable from
  the app's code.
- Offline behavior is intentionally minimal: static shell assets (icons, manifest)
  are cached, and a simple offline page shows if someone loses connection mid-visit.
  The dashboard itself is NOT cached for offline use, since it shows live cleaning
  status — showing stale "done/pending" data offline would be actively misleading.
- Icons are in `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`
  — currently a placeholder QR+checkmark mark. Swap these out once you have real
  branding.

## Setup

### 1. Create a Supabase project
- Go to supabase.com, create a new project
- In the SQL editor, run everything in `supabase/schema.sql`
- In Storage, create a **public** bucket named `scan-photos` (for cleaner photo uploads)
- Copy your Project URL, anon key, and service role key from Project Settings > API

### 2. Create a Stripe account (test mode is fine to start)
- Create a Product + recurring Price (e.g. $15/mo) — copy the Price ID
- Get your test secret key from the Stripe dashboard
- For local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
  (this gives you a webhook signing secret)

### 3. Environment variables
Copy `.env.local.example` to `.env.local` and fill in the real values from steps 1-2.

### 4. Install & run
```bash
npm install
npm run dev
```
Visit http://localhost:3000

## Trying the core flow locally
1. Sign up as a host at `/signup`
2. On the dashboard, add a property
3. Add a few zones (Kitchen, Bathroom, Fridge — suggestion chips are there)
4. Click "Print QR sheet" — you'll see real QR codes pointing to `/scan/{zoneId}`
5. Back on the property page, click "Start turnover"
6. Open one of the QR-coded URLs (scan it with your phone, or just click the link in
   dev) — you'll land on the cleaner-facing page, no login needed
7. Mark the zone done — go back to the property page and refresh; it now shows "Done"

## Known gaps / next steps before charging real customers
- **Billing enforcement**: signing up doesn't currently require payment. Decide your
  trial length and add a check that redirects to a "subscribe" screen once
  `hosts.subscription_status` isn't `trialing`/`active`.
- **Storage bucket policy**: the `scan-photos` bucket needs to be public (or served via
  signed URLs) since photos are shown on the host dashboard without the cleaner being
  logged in — double check this in Supabase Storage settings.
- **Email**: no transactional email yet — Supabase Auth sends its own confirmation
  emails by default, which is enough to start.
- **Deploy**: push to GitHub, import into Vercel, add the same env vars there, point
  `NEXT_PUBLIC_APP_URL` at your real domain (this is what gets encoded into every QR
  code, so get the domain right before printing real stickers).
