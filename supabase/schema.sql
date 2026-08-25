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

-- Realtime: lets the host's dashboard subscribe to live changes instead of polling.
-- Existing RLS SELECT policies on these tables still govern what a subscriber can see.
alter publication supabase_realtime add table public.scan_records;
alter publication supabase_realtime add table public.scan_item_completions;
alter publication supabase_realtime add table public.turnover_sessions;

-- ============================================================================
-- QR SET PROVISIONING
--
-- Breaking migration: zones stop being host-created rows with a random UUID
-- QR code minted after the fact. Instead, physical QR sticker sheets are
-- provisioned in bulk ahead of time (qr_sets + qr_set_zones, admin-only,
-- inserted directly via SQL/service role — never through host-facing RLS),
-- each with a fixed set of zone slugs printed on it. A property "claims" the
-- next available set atomically when it's created, and releases it back to
-- the unclaimed pool when the property is deleted, so the same physical
-- sheet can be reused by a later property.
--
-- This drops the old zones / zone_checklist_items / scan_records tables and
-- everything built on them. No migration path for existing rows — the only
-- data in those tables is test data from this project's early development.
-- ============================================================================

drop table if exists public.scan_records cascade;
drop table if exists public.zone_checklist_items cascade;
drop table if exists public.zones cascade;

create table if not exists public.qr_sets (
  id text primary key, -- e.g. "SET_001", printed on the physical sheet
  status text not null default 'unclaimed', -- unclaimed | claimed | retired
  created_at timestamptz default now()
);

create table if not exists public.qr_set_zones (
  set_id text not null references public.qr_sets(id) on delete cascade,
  zone_slug text not null,   -- e.g. "bathroom_1" — encoded in the printed QR code
  zone_label text not null,  -- e.g. "Bathroom 1" — printed alongside the code
  sort_order int not null default 0,
  primary key (set_id, zone_slug)
);

create table if not exists public.property_set_claims (
  id uuid primary key default gen_random_uuid(),
  -- Nullable + ON DELETE SET NULL (not CASCADE): once a property is deleted,
  -- the claim row survives as history ("SET_003 was previously used by
  -- property X") instead of disappearing with it.
  property_id uuid references public.properties(id) on delete set null,
  set_id text not null references public.qr_sets(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  released_at timestamptz
);

-- At most one *active* (released_at is null) claim per set, and per property,
-- at a time — enforced at the database level, not just in application code.
create unique index if not exists idx_property_set_claims_active_set
  on public.property_set_claims(set_id) where released_at is null;
create unique index if not exists idx_property_set_claims_active_property
  on public.property_set_claims(property_id) where released_at is null;

-- Checklist items are now keyed by (property_id, zone_slug) instead of a
-- zones.id foreign key, since the zone itself is no longer a host-owned row.
create table if not exists public.zone_checklist_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  zone_slug text not null,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Per-zone settings a host can still customize per property (task
-- instructions, whether a photo is required) even though the zone's slug
-- and label come from the claimed physical set.
create table if not exists public.property_zone_settings (
  property_id uuid not null references public.properties(id) on delete cascade,
  zone_slug text not null,
  task_description text,
  require_photo boolean not null default false,
  primary key (property_id, zone_slug)
);

create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.turnover_sessions(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  zone_slug text not null,
  cleaner_id uuid references public.cleaners(id) on delete set null,
  scanned_at timestamptz default now(),
  photo_url text,
  unique (session_id, zone_slug)
);

create index if not exists idx_qr_set_zones_set on public.qr_set_zones(set_id);
create index if not exists idx_zone_checklist_items_property_zone on public.zone_checklist_items(property_id, zone_slug);
create index if not exists idx_scan_events_session on public.scan_events(session_id);
create index if not exists idx_scan_events_property_zone on public.scan_events(property_id, zone_slug);

alter table public.qr_sets enable row level security;
alter table public.qr_set_zones enable row level security;
alter table public.property_set_claims enable row level security;
alter table public.zone_checklist_items enable row level security;
alter table public.property_zone_settings enable row level security;
alter table public.scan_events enable row level security;

-- qr_sets: intentionally NO policies for the authenticated role. Provisioning
-- and claiming both go through SECURITY DEFINER functions below, which
-- bypass RLS — hosts never touch this table directly.

drop policy if exists "hosts read zones of their claimed sets" on public.qr_set_zones;
create policy "hosts read zones of their claimed sets" on public.qr_set_zones
  for select using (
    exists (
      select 1 from public.property_set_claims c
      join public.properties p on p.id = c.property_id
      where c.set_id = qr_set_zones.set_id
        and c.released_at is null
        and p.host_id = auth.uid()
    )
  );

drop policy if exists "hosts read own claims" on public.property_set_claims;
create policy "hosts read own claims" on public.property_set_claims
  for select using (
    exists (select 1 from public.properties p where p.id = property_set_claims.property_id and p.host_id = auth.uid())
  );

drop policy if exists "hosts manage zone checklist items on own properties" on public.zone_checklist_items;
create policy "hosts manage zone checklist items on own properties" on public.zone_checklist_items
  for all using (
    exists (select 1 from public.properties p where p.id = zone_checklist_items.property_id and p.host_id = auth.uid())
  );

drop policy if exists "hosts manage zone settings on own properties" on public.property_zone_settings;
create policy "hosts manage zone settings on own properties" on public.property_zone_settings
  for all using (
    exists (select 1 from public.properties p where p.id = property_zone_settings.property_id and p.host_id = auth.uid())
  );

drop policy if exists "hosts read scan events on own properties" on public.scan_events;
create policy "hosts read scan events on own properties" on public.scan_events
  for select using (
    exists (select 1 from public.properties p where p.id = scan_events.property_id and p.host_id = auth.uid())
  );

-- Atomically claims the lowest-id unclaimed set for a property the caller
-- actually owns. FOR UPDATE SKIP LOCKED means two concurrent property
-- creations never race for the same set — a locked row is simply skipped in
-- favor of the next available one, rather than blocking.
create or replace function public.claim_next_qr_set(p_property_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_set_id text;
  v_owner uuid;
begin
  select host_id into v_owner from public.properties where id = p_property_id;
  if v_owner is null then
    raise exception 'Property not found';
  end if;
  -- IS DISTINCT FROM (not <>) matters here: with plain <>, a NULL auth.uid()
  -- (an unauthenticated/anon caller) makes the comparison evaluate to NULL
  -- rather than TRUE, which Postgres treats as "condition not met" — silently
  -- skipping the authorization check entirely.
  if v_owner is distinct from auth.uid() then
    raise exception 'Not authorized to claim a set for this property';
  end if;

  select id into v_set_id
  from public.qr_sets
  where status = 'unclaimed'
  order by id
  for update skip locked
  limit 1;

  if v_set_id is null then
    raise exception 'No unclaimed QR sets available';
  end if;

  update public.qr_sets set status = 'claimed' where id = v_set_id;

  insert into public.property_set_claims (property_id, set_id)
  values (p_property_id, v_set_id);

  return v_set_id;
end;
$$;

grant execute on function public.claim_next_qr_set(uuid) to authenticated;

-- Releases a property's active claim back to the unclaimed pool right before
-- the property row is deleted, so the physical sheet can be claimed again.
create or replace function public.release_qr_set_on_property_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_set_id text;
begin
  select set_id into v_set_id
  from public.property_set_claims
  where property_id = old.id and released_at is null
  limit 1;

  if v_set_id is not null then
    update public.property_set_claims
    set released_at = now()
    where property_id = old.id and released_at is null;

    update public.qr_sets set status = 'unclaimed' where id = v_set_id;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_release_qr_set_on_property_delete on public.properties;
create trigger trg_release_qr_set_on_property_delete
  before delete on public.properties
  for each row execute function public.release_qr_set_on_property_delete();

-- Realtime for the new scan table (replaces scan_records in the publication
-- added above — that ALTER PUBLICATION line is now a no-op since the table
-- it referenced was just dropped).
alter publication supabase_realtime add table public.scan_events;
alter publication supabase_realtime add table public.zone_checklist_items;

-- ============================================================================
-- MULTIPLE PHOTOS PER ZONE SCAN
--
-- scan_events.photo_url only ever held one photo, so re-scanning a zone (or
-- attaching more than one photo at once) silently discarded everything but
-- the last upload. Moves photos to their own table: as many as a cleaner
-- attaches are kept, none replace each other.
-- ============================================================================

alter table public.scan_events drop column if exists photo_url;

create table if not exists public.scan_event_photos (
  id uuid primary key default gen_random_uuid(),
  scan_event_id uuid not null references public.scan_events(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_event_photos_scan_event on public.scan_event_photos(scan_event_id);

-- Nullable: only new uploads compute these, existing rows aren't backfilled.
-- Lets us flag a photo whose bytes exactly match one already uploaded by the
-- same host (any property), a sign a cleaner may be reusing an old photo.
alter table public.scan_event_photos add column if not exists photo_hash text;
alter table public.scan_event_photos add column if not exists host_id uuid references public.hosts(id) on delete cascade;
alter table public.scan_event_photos add column if not exists is_duplicate boolean not null default false;

create index if not exists idx_scan_event_photos_host_hash on public.scan_event_photos(host_id, photo_hash);

alter table public.scan_event_photos enable row level security;

drop policy if exists "hosts read scan event photos on own properties" on public.scan_event_photos;
create policy "hosts read scan event photos on own properties" on public.scan_event_photos
  for select using (
    exists (
      select 1 from public.scan_events se
      join public.properties p on p.id = se.property_id
      where se.id = scan_event_photos.scan_event_id and p.host_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.scan_event_photos;

-- ============================================================================
-- PREVENT DUPLICATE ACTIVE TURNOVERS
--
-- Rapid repeated taps on "Start turnover" (the client's own guard against
-- double-submission can lose the race on a slow/mobile tap) could create
-- several in_progress sessions for the same property at once, leaving
-- "which session is active" ambiguous everywhere that assumes there's one.
-- Enforced here at the database level rather than relying on the client
-- alone.
-- ============================================================================

create unique index if not exists idx_turnover_sessions_one_active_per_property
  on public.turnover_sessions(property_id) where status = 'in_progress';
