-- Apply once in the Supabase SQL Editor before deploying the waterproof kit order flow.
create table if not exists public.qr_kit_orders (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  stripe_session_id text not null unique,
  amount_cents integer not null,
  currency text not null default 'usd',
  payment_status text not null,
  fulfillment_status text not null default 'new',
  zone_count integer not null default 0,
  shipping_name text,
  shipping_phone text,
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_postal_code text,
  shipping_country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qr_kit_orders enable row level security;

drop policy if exists "hosts read own QR kit orders" on public.qr_kit_orders;
create policy "hosts read own QR kit orders" on public.qr_kit_orders
  for select to authenticated using ((select auth.uid()) = host_id);

revoke all on table public.qr_kit_orders from anon, authenticated;
grant select on table public.qr_kit_orders to authenticated;
