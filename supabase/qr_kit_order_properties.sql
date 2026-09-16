-- Apply once in the Supabase SQL Editor before deploying portfolio QR Kit orders.
create table if not exists public.qr_kit_order_properties (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.qr_kit_orders(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  property_name text not null,
  zone_count integer not null default 0,
  unit_amount_cents integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (order_id, property_id)
);

alter table public.qr_kit_order_properties enable row level security;

drop policy if exists "hosts read own QR kit order properties" on public.qr_kit_order_properties;
create policy "hosts read own QR kit order properties" on public.qr_kit_order_properties
  for select to authenticated using (
    exists (
      select 1 from public.qr_kit_orders orders
      where orders.id = qr_kit_order_properties.order_id
        and orders.host_id = (select auth.uid())
    )
  );

revoke all on table public.qr_kit_order_properties from anon, authenticated;
grant select on table public.qr_kit_order_properties to authenticated;
