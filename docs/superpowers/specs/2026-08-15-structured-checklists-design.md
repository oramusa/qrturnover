# Structured, per-item checklists by zone

## Problem

Today each zone (`zones.checklist_items`) stores a single newline-separated text blob, set once when the zone is created via a textarea. There is no way to edit an existing zone's checklist afterward, no way to add/remove individual items without retyping the whole block, no reuse across zones/properties, and the cleaner-facing view is a plain read-only bullet list — it does not track which items were actually done.

## Goals

- Host can add, edit, and remove individual checklist items per zone (not one big text blob).
- Host can define reusable checklist templates by room type (e.g. "Kitchen": Refrigerator, Countertops, Sink, Floor, Trash, Paper towels stocked), scoped to their account.
- New zones auto-fill from a matching template (by room-type name, case-insensitive) if one exists; the zone then owns an independent copy — editing the zone never changes the template or other zones, and vice versa.
- A zone's checklist can also be saved back as a template from the zone's own editor, so templates can be built organically without a separate setup step.
- Cleaners check off items individually while cleaning a zone, instead of just reading a static list.
- A zone cannot be marked done until every checklist item is checked (same enforcement pattern as the existing `require_photo` rule — both conditions apply together if both are set).
- Host sees per-item progress (e.g. "3/5 items") on the property page while a turnover is active, not just zone-level Pending/Done.

## Non-goals

- Templates do not stay "live-linked" to zones that were created from them — no cascading edits.
- No global/shared template library across hosts — templates are per-account only.
- No reordering UI beyond insertion order (items append to the end; deletion just removes).

## Data model

Four new tables, replacing the old `zones.checklist_items` text column (which becomes unused going forward — existing values get migrated into real rows once, then the column can be dropped in a later cleanup):

```sql
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts(id) on delete cascade,
  room_type text not null, -- e.g. "Kitchen" — matched case-insensitively against zone names
  created_at timestamptz default now(),
  unique (host_id, room_type)
);

create table public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table public.zone_checklist_items (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table public.scan_item_completions (
  scan_record_id uuid not null references public.scan_records(id) on delete cascade,
  item_id uuid not null references public.zone_checklist_items(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (scan_record_id, item_id)
);
```

RLS: `checklist_templates`, `checklist_template_items`, `zone_checklist_items` follow the same "hosts manage own X" ownership pattern as existing tables (join up to `host_id = auth.uid()`). `scan_item_completions` follows the same pattern as `scan_records` (host can read via their own sessions; writes happen through the existing service-role `/api/scan` style route since cleaners have no auth session).

**Migration of existing data:** a one-time script copies each zone's existing `checklist_items` text (split on newlines) into `zone_checklist_items` rows, preserving order via `sort_order`. Runs once against the current Supabase project as part of implementation, not as an ongoing app code path.

## Template management page

New page at `/checklists`, linked from the dashboard nav (next to "Cleaners"). Same list/add/delete pattern as the existing `/cleaners` page:

- Lists existing templates (room type name + item count).
- Each template expands to show its items with individual delete (×) and an "add item" input, matching the zone-level editor UX described below.
- "+ New template" lets the host type a room type name (e.g. "Kitchen") and start adding items.
- Delete removes the whole template (does not touch any zone that previously copied from it).

## Zone creation — auto-fill from template

In `ZoneManager` (property page), when a new zone is created — whether by typing a name or tapping a quick-add suggestion chip (Kitchen/Bathroom/Bedroom/Living Room/Fridge/Entryway) — the server checks for a `checklist_templates` row matching `host_id` + that exact name, case-insensitive but not partial (e.g. "Kitchen 2" does not match a "Kitchen" template — only an exact "Kitchen" does). If found, its items are copied into new `zone_checklist_items` rows for the new zone. If not found, the zone starts with zero items.

## Zone checklist editor (property page)

Each zone row on the property page gets an expandable "Checklist" section (replacing the current static bullet display):

- Shows current items, each with inline click-to-edit text and a delete (×) button.
- An "add item" input + button at the bottom appends a new item.
- A "Save as template" button (labeled with the zone's name, e.g. "Save as Kitchen template") upserts a `checklist_templates` row for that room-type name and replaces its `checklist_template_items` with the zone's current items — this is the mechanism for building/updating templates without a separate authoring step, and it's an explicit one-time action (does not create an ongoing link).
- The existing "photo required" toggle and task description field stay as-is; the checklist section is additive.

Edits save immediately per item (add/edit/delete each trigger their own request), consistent with how deletes work elsewhere in the app (`DeleteZoneButton`, `DeleteCleanerButton`) — no separate "save" step for the whole list.

## Cleaner-facing checkoff (scan page)

`ScanClient`/`ScanForm` on the cleaner's zone page render each checklist item as a tappable checkbox row instead of a static bullet. Tapping toggles it immediately via a new endpoint (`POST /api/scan-item`, service-role, validated the same way `/api/scan` validates zone/session ownership) that upserts/deletes the corresponding `scan_item_completions` row. State is re-fetched the same way `ScanClient` already re-fetches session state (via `/api/scan-session`, which will now also return each item's id/label/completed status for the current active session).

"Mark done" (the existing `ScanForm` submit) becomes disabled until all items for that zone are checked, in addition to the existing photo-required check — both must pass if both apply. The button's disabled state shows which condition is unmet (e.g. "2 items left" / "photo required").

## Host visibility (property page, active turnover)

The existing Pending/Done badge per zone (in `properties/[id]/page.tsx`) gains a small item-count suffix while a turnover is active and the zone has checklist items, e.g. "Pending · 3/5 items". This reuses the same `scan_records`/session query already on that page, joined against `scan_item_completions` for the active session.

## Out of scope / follow-ups not included here

- Dropping the old `zones.checklist_items` column (leave it in place, just unused, to avoid a breaking migration in this pass).
- Reordering items via drag-and-drop.
- Per-item photo requirements (only whole-zone `require_photo` exists today; not extended here).
