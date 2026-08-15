-- QRTurnover schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

-- Hosts are just Supabase auth.users; we store extra profile/billing info here.
create table if not exists public.hosts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text,
  subscription_status text default 'trialing', -- trialing | active | past_due | canceled
  trial_ends_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz default now()
);

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,           -- "Kitchen", "Bathroom 1", "Fridge"
  task_description text,        -- optional instructions shown to the cleaner
  checklist_items text,         -- optional, newline-separated: "Toilet paper stocked\nNo hair in drain"
  require_photo boolean default false, -- if true, cleaner can't mark done without a photo
  sort_order int default 0,
  created_at timestamptz default now()
);

-- A cleaner belongs to one host and can be assigned to multiple properties.
-- No password: cleaners authenticate with a short access code (PIN-style) that
-- the host gives them once — kept low-friction on purpose, this is not meant
-- to be bank-grade auth, just enough to attribute work to a specific person.
create table if not exists public.cleaners (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts(id) on delete cascade,
  name text not null,
  contact text, -- phone or email, optional
  access_code text not null, -- short code the cleaner enters once per device
  created_at timestamptz default now(),
  unique (host_id, access_code)
);

create table if not exists public.property_cleaners (
  property_id uuid not null references public.properties(id) on delete cascade,
  cleaner_id uuid not null references public.cleaners(id) on delete cascade,
  primary key (property_id, cleaner_id)
);

create table if not exists public.turnover_sessions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  cleaner_id uuid references public.cleaners(id) on delete set null,
  status text not null default 'in_progress', -- in_progress | complete
  started_at timestamptz default now(),
  completed_at timestamptz,
  job_started_at timestamptz,   -- when the cleaner tapped "Start job" (may differ from started_at)
  job_finished_at timestamptz   -- when the cleaner tapped "Finish job"
);

create table if not exists public.scan_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.turnover_sessions(id) on delete cascade,
  zone_id uuid not null references public.zones(id) on delete cascade,
  cleaner_id uuid references public.cleaners(id) on delete set null,
  scanned_at timestamptz default now(),
  photo_url text,
  unique (session_id, zone_id) -- scanning the same zone twice just updates, doesn't duplicate
);

-- Helpful index for "which zones are still pending in this session" dashboard queries
create index if not exists idx_scan_records_session on public.scan_records(session_id);
create index if not exists idx_zones_property on public.zones(property_id);
create index if not exists idx_properties_host on public.properties(host_id);
create index if not exists idx_cleaners_host on public.cleaners(host_id);
create index if not exists idx_turnover_sessions_cleaner on public.turnover_sessions(cleaner_id);

-- Row Level Security: hosts can only see/manage their own data.
alter table public.hosts enable row level security;
alter table public.properties enable row level security;
alter table public.zones enable row level security;
alter table public.turnover_sessions enable row level security;
alter table public.scan_records enable row level security;
alter table public.cleaners enable row level security;
alter table public.property_cleaners enable row level security;

drop policy if exists "hosts read own row" on public.hosts;
create policy "hosts read own row" on public.hosts
  for select using (auth.uid() = id);
drop policy if exists "hosts insert own row" on public.hosts;
create policy "hosts insert own row" on public.hosts
  for insert with check (auth.uid() = id);
drop policy if exists "hosts update own row" on public.hosts;
create policy "hosts update own row" on public.hosts
  for update using (auth.uid() = id);

drop policy if exists "hosts manage own properties" on public.properties;
create policy "hosts manage own properties" on public.properties
  for all using (auth.uid() = host_id);

drop policy if exists "hosts manage zones on own properties" on public.zones;
create policy "hosts manage zones on own properties" on public.zones
  for all using (
    exists (select 1 from public.properties p where p.id = zones.property_id and p.host_id = auth.uid())
  );

drop policy if exists "hosts manage sessions on own properties" on public.turnover_sessions;
create policy "hosts manage sessions on own properties" on public.turnover_sessions
  for all using (
    exists (select 1 from public.properties p where p.id = turnover_sessions.property_id and p.host_id = auth.uid())
  );

drop policy if exists "hosts read scan records on own properties" on public.scan_records;
create policy "hosts read scan records on own properties" on public.scan_records
  for select using (
    exists (
      select 1 from public.turnover_sessions s
      join public.properties p on p.id = s.property_id
      where s.id = scan_records.session_id and p.host_id = auth.uid()
    )
  );

drop policy if exists "hosts manage own cleaners" on public.cleaners;
create policy "hosts manage own cleaners" on public.cleaners
  for all using (auth.uid() = host_id);

drop policy if exists "hosts manage assignments on own properties" on public.property_cleaners;
create policy "hosts manage assignments on own properties" on public.property_cleaners
  for all using (
    exists (select 1 from public.properties p where p.id = property_cleaners.property_id and p.host_id = auth.uid())
  );

-- Auto-create the matching hosts row when a new auth user signs up.
-- Runs as security definer (bypasses RLS) so it works even when the user has
-- no session yet, e.g. while email confirmation is pending.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.hosts (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- NOTE on the cleaner-facing scan flow:
-- Cleaners never log in, so scan inserts happen through a server-side API route
-- (using the Supabase service role key, not the browser client) rather than a
-- browser-side RLS policy. Keep the service role key server-only (.env, never
-- exposed to the client).

-- Structured per-item checklists (superseding the old free-text zones.checklist_items,
-- which is left in place but unused going forward — see docs/superpowers/specs/2026-08-15-structured-checklists-design.md)

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts(id) on delete cascade,
  room_type text not null, -- e.g. "Kitchen" — matched exactly, case-insensitively, against zone names
  created_at timestamptz default now(),
  unique (host_id, room_type)
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.zone_checklist_items (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Keyed by session (not scan_record) so items can be checked off before the
-- zone is marked done — a scan_records row for this zone/session may not
-- exist yet when the cleaner starts ticking items.
create table if not exists public.scan_item_completions (
  session_id uuid not null references public.turnover_sessions(id) on delete cascade,
  item_id uuid not null references public.zone_checklist_items(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (session_id, item_id)
);

create index if not exists idx_checklist_template_items_template on public.checklist_template_items(template_id);
create index if not exists idx_zone_checklist_items_zone on public.zone_checklist_items(zone_id);
create index if not exists idx_scan_item_completions_session on public.scan_item_completions(session_id);

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.zone_checklist_items enable row level security;
alter table public.scan_item_completions enable row level security;

drop policy if exists "hosts manage own checklist templates" on public.checklist_templates;
create policy "hosts manage own checklist templates" on public.checklist_templates
  for all using (auth.uid() = host_id);

drop policy if exists "hosts manage own template items" on public.checklist_template_items;
create policy "hosts manage own template items" on public.checklist_template_items
  for all using (
    exists (select 1 from public.checklist_templates t where t.id = checklist_template_items.template_id and t.host_id = auth.uid())
  );

drop policy if exists "hosts manage zone checklist items on own properties" on public.zone_checklist_items;
create policy "hosts manage zone checklist items on own properties" on public.zone_checklist_items
  for all using (
    exists (
      select 1 from public.zones z
      join public.properties p on p.id = z.property_id
      where z.id = zone_checklist_items.zone_id and p.host_id = auth.uid()
    )
  );

drop policy if exists "hosts read scan item completions on own properties" on public.scan_item_completions;
create policy "hosts read scan item completions on own properties" on public.scan_item_completions
  for select using (
    exists (
      select 1 from public.turnover_sessions s
      join public.properties p on p.id = s.property_id
      where s.id = scan_item_completions.session_id and p.host_id = auth.uid()
    )
  );

-- Backfill: copy any existing free-text checklist_items into real rows, once.
-- Safe to re-run: only fills zones that don't already have structured items.
insert into public.zone_checklist_items (zone_id, label, sort_order)
select z.id, trim(t.line), t.ordinality - 1
from public.zones z
cross join lateral unnest(string_to_array(z.checklist_items, E'\n')) with ordinality as t(line, ordinality)
where z.checklist_items is not null
  and trim(t.line) <> ''
  and not exists (select 1 from public.zone_checklist_items zci where zci.zone_id = z.id);
