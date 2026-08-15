# Structured Per-Item Checklists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single free-text `zones.checklist_items` field with per-item, editable checklists per zone, reusable templates by room type, cleaner-facing checkboxes, and gating "Mark done" on full completion.

**Architecture:** Four new Postgres tables (`checklist_templates`, `checklist_template_items`, `zone_checklist_items`, `scan_item_completions`), RLS-protected direct Supabase calls for all host-side CRUD (same pattern as existing `NewCleanerForm`/`DeleteCleanerButton`), and two service-role API routes for the unauthenticated cleaner-facing flow (extending `/api/scan-session`, adding `/api/scan-item`, and hardening `/api/scan`).

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS + `@supabase/supabase-js` browser client), TypeScript, Tailwind.

## Global Constraints

- Follow the design in `docs/superpowers/specs/2026-08-15-structured-checklists-design.md`.
- Template matching against a zone name is **exact, case-insensitive** — not partial (spec: "Kitchen 2" does not match "Kitchen").
- A zone's items are an independent copy after creation — editing a zone never touches the template that seeded it, and vice versa (spec: "Zone owns its own copy after pre-fill").
- "Mark done" must be blocked until all checklist items are checked, same enforcement pattern as the existing `require_photo` rule — and this must be enforced **server-side** in `/api/scan`, not just as a disabled button, matching how `require_photo` is already enforced server-side there.
- All input elements must have explicit `bg-white text-gray-900` (or equivalent) styling — this codebase had a real production bug earlier from inputs inheriting near-white text on a light background in dark mode. Every new `<input>`/`<textarea>` in this plan must set explicit colors.
- Host-side database writes go through the browser Supabase client (RLS-protected), matching existing patterns (`NewCleanerForm.tsx`, `DeleteZoneButton.tsx`). Only cleaner-facing (unauthenticated) writes go through service-role API routes.
- **No test framework exists in this codebase** (`package.json` has no jest/vitest/playwright). Verification in this plan uses: (a) `npx tsc --noEmit` for type-safety on component-only tasks, (b) direct PostgREST calls against the local Supabase project — via a disposable throwaway host account for RLS-protected paths, and the service-role key for service-role paths — to prove the data layer behaves correctly, mirroring the verification approach already used successfully earlier in this project's development. Each task's steps show the exact `curl` commands and expected output.
- Dev server runs via `npm run dev -- -p 3002` in `/Users/alpaytonga/Desktop/turnover-app`, with `.env.local` already populated (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

---

## Task 0: Create a disposable test host account for verification

This account is reused (re-authenticated as needed) across every later task's verification steps, then deleted in the final task.

**Files:** none (setup only).

- [ ] **Step 1: Sign up a throwaway host**

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"planverify@example.com","password":"verify-pass-123"}'
```

Expected: JSON response with a `"access_token"` field (email confirmation is disabled on this project, so a session is issued immediately — no email step needed). Save this response; note it also returns a `user.id` — that is this test host's id, and a matching row was auto-created in `public.hosts` by the existing `on_auth_user_created` trigger.

- [ ] **Step 2: Define a reusable login snippet**

Every later verification step that needs a fresh token runs this first (tokens expire in ~1hr):

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
TOKEN=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"planverify@example.com","password":"verify-pass-123"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))")
echo "$TOKEN"
```

Expected: prints a long JWT string, no error.

- [ ] **Step 3: Get the test host's id and create one test property**

```bash
HOST_ID=$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/hosts?select=id&email=eq.planverify@example.com" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id))")
echo "host: $HOST_ID"

PROPERTY_ID=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/properties" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"host_id\":\"$HOST_ID\",\"name\":\"Verify Property\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id))")
echo "property: $PROPERTY_ID"
```

Expected: both print valid UUIDs. Save `HOST_ID` and `PROPERTY_ID` — every later task's verification reuses these exact values.

---

## Task 1: Add checklist tables, RLS policies, and backfill migration

**Files:**
- Modify: `supabase/schema.sql` (append after the existing "NOTE on the cleaner-facing scan flow" comment at the end of the file)

**Interfaces:**
- Produces: tables `checklist_templates(id, host_id, room_type, created_at)`, `checklist_template_items(id, template_id, label, sort_order, created_at)`, `zone_checklist_items(id, zone_id, label, sort_order, created_at)`, `scan_item_completions(session_id, item_id, completed_at)` — all later tasks read/write these exact table and column names.

- [ ] **Step 1: Append the new tables, indexes, RLS policies, and backfill to `supabase/schema.sql`**

Add this block at the end of the file:

```sql

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
```

- [ ] **Step 2: Run it in the Supabase SQL editor**

Go to https://supabase.com/dashboard/project/haunrcyrwgwhywtbcrve/sql/new, paste the entire `supabase/schema.sql` file (the whole file is idempotent — safe to re-run in full), and run it.

- [ ] **Step 3: Verify the tables exist and RLS blocks cross-host access**

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
# Re-login (Task 0 Step 2) to get a fresh $TOKEN if needed.

# A test host can create a template for themselves:
curl -s -i -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_templates" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"host_id\":\"$HOST_ID\",\"room_type\":\"Kitchen Test\"}"
```

Expected: `HTTP/1.1 201 Created`.

```bash
# The SAME host cannot create a template claiming a different host_id (RLS should reject it):
curl -s -i -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_templates" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"host_id\":\"00000000-0000-0000-0000-000000000000\",\"room_type\":\"Hacked\"}"
```

Expected: `HTTP/1.1 403 Forbidden` (RLS policy violation).

```bash
# Clean up the test template so later tasks start fresh:
curl -s -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_templates?room_type=eq.Kitchen%20Test" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"
```

- [ ] **Step 4: Verify the backfill migration worked on existing data**

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
# Any pre-existing zone that had free-text checklist_items should now have matching rows.
# The test zones created earlier this session (Kitchen/Bathroom/Bedroom under "tampahouse")
# had NULL checklist_items, so expect an EMPTY array for them — that's correct, not a failure.
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/zone_checklist_items?select=*" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `[]` (empty array) if no existing zone had free-text checklist content — confirms the migration ran without error rather than confirming specific rows.

- [ ] **Step 5: Commit**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
git add supabase/schema.sql
git commit -m "$(cat <<'EOF'
feat: add structured checklist tables (templates, zone items, completions)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared ChecklistItemsEditor component

**Files:**
- Create: `components/ChecklistItemsEditor.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure presentational component).
- Produces: `ChecklistItemsEditor` component with props `{ items: {id: string; label: string}[]; onAdd: (label: string) => Promise<void>; onEdit: (id: string, label: string) => Promise<void>; onDelete: (id: string) => Promise<void>; disabled?: boolean }` — Tasks 3 and 5 import and wrap this with their own Supabase calls.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";

export default function ChecklistItemsEditor({
  items,
  onAdd,
  onEdit,
  onDelete,
  disabled,
}: {
  items: { id: string; label: string }[];
  onAdd: (label: string) => Promise<void>;
  onEdit: (id: string, label: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true);
    await onAdd(newLabel.trim());
    setNewLabel("");
    setBusy(false);
  }

  async function handleEditSave(id: string) {
    if (!editingLabel.trim()) return;
    setBusy(true);
    await onEdit(id, editingLabel.trim());
    setEditingId(null);
    setBusy(false);
  }

  async function handleDelete(id: string) {
    setBusy(true);
    await onDelete(id);
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-gray-400">No items yet — add one below.</p>
      )}
      {items.map((item) =>
        editingId === item.id ? (
          <div key={item.id} className="flex items-center gap-2">
            <input
              value={editingLabel}
              onChange={(e) => setEditingLabel(e.target.value)}
              autoFocus
              className="flex-1 border rounded px-2 py-1 text-sm bg-white text-gray-900"
            />
            <button
              type="button"
              onClick={() => handleEditSave(item.id)}
              disabled={busy || disabled}
              className="text-xs text-gray-700 hover:text-black disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setEditingId(item.id);
                setEditingLabel(item.label);
              }}
              className="text-left flex-1 text-gray-900 hover:underline"
            >
              {item.label}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              disabled={busy || disabled}
              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )
      )}
      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Add an item (e.g. Refrigerator)"
          className="flex-1 border rounded px-2 py-1 text-sm bg-white text-gray-900"
        />
        <button
          type="submit"
          disabled={busy || disabled || !newLabel.trim()}
          className="text-xs border rounded px-2 py-1 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
npx tsc --noEmit
```

Expected: no errors mentioning `ChecklistItemsEditor.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ChecklistItemsEditor.tsx
git commit -m "$(cat <<'EOF'
feat: add shared ChecklistItemsEditor component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Checklist templates management page

**Files:**
- Create: `app/checklists/page.tsx`
- Create: `app/checklists/NewTemplateForm.tsx`
- Create: `app/checklists/TemplateCard.tsx`
- Modify: `app/dashboard/page.tsx:27-33` (nav row with the "Cleaners" / "Log out" links)

**Interfaces:**
- Consumes: `ChecklistItemsEditor` from Task 2 (`components/ChecklistItemsEditor.tsx`).
- Produces: page at `/checklists`. No other task depends on these files directly (Task 4 queries the `checklist_templates`/`checklist_template_items` tables directly, not through these components).

- [ ] **Step 1: Write `app/checklists/TemplateCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ChecklistItemsEditor from "@/components/ChecklistItemsEditor";

export default function TemplateCard({
  templateId,
  roomType,
  items,
}: {
  templateId: string;
  roomType: string;
  items: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleAdd(label: string) {
    const supabase = createClient();
    await supabase.from("checklist_template_items").insert({
      template_id: templateId,
      label,
      sort_order: items.length,
    });
    router.refresh();
  }

  async function handleEdit(id: string, label: string) {
    const supabase = createClient();
    await supabase.from("checklist_template_items").update({ label }).eq("id", id);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("checklist_template_items").delete().eq("id", id);
    router.refresh();
  }

  async function handleDeleteTemplate() {
    if (!confirm(`Delete the "${roomType}" template? Zones already using it are unaffected.`)) {
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("checklist_templates").delete().eq("id", templateId);
    router.refresh();
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-left font-medium"
        >
          {roomType} <span className="text-xs text-gray-400">({items.length} items)</span>
        </button>
        <button
          type="button"
          onClick={handleDeleteTemplate}
          disabled={deleting}
          className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
        >
          Delete template
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <ChecklistItemsEditor
            items={items}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `app/checklists/NewTemplateForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewTemplateForm() {
  const [open, setOpen] = useState(false);
  const [roomType, setRoomType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're not logged in. Please log in again.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("checklist_templates")
      .insert({ host_id: user.id, room_type: roomType.trim() });

    setLoading(false);
    if (insertError) {
      setError(
        insertError.code === "23505"
          ? `You already have a "${roomType.trim()}" template.`
          : insertError.message
      );
      return;
    }
    setRoomType("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 hover:text-gray-900"
      >
        + New template
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 max-w-sm bg-white text-gray-900">
      <input
        placeholder="Room type (e.g. Kitchen)"
        required
        value={roomType}
        onChange={(e) => setRoomType(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm bg-white text-gray-900"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white text-sm rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Write `app/checklists/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NewTemplateForm from "./NewTemplateForm";
import TemplateCard from "./TemplateCard";

export default async function ChecklistsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: templates } = await supabase
    .from("checklist_templates")
    .select("id, room_type, checklist_template_items ( id, label, sort_order )")
    .eq("host_id", user!.id)
    .order("room_type", { ascending: true });

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link href="/dashboard" className="text-sm text-gray-500 underline">
        &larr; Dashboard
      </Link>

      <h1 className="text-2xl font-semibold mt-2 mb-2">Checklist templates</h1>
      <p className="text-sm text-gray-500 mb-6">
        Define default items by room type (e.g. Kitchen, Bathroom). New zones with a matching
        name automatically start with these items — each zone then owns its own independent
        copy, so editing a zone never changes the template.
      </p>

      <NewTemplateForm />

      <div className="space-y-3 mt-6">
        {templates?.length === 0 && (
          <p className="text-gray-500 text-sm">No templates yet. Add one above.</p>
        )}
        {templates?.map((t) => (
          <TemplateCard
            key={t.id}
            templateId={t.id}
            roomType={t.room_type}
            items={(t.checklist_template_items ?? [])
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((i) => ({ id: i.id, label: i.label }))}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add a nav link from the dashboard**

In `app/dashboard/page.tsx`, this exact block currently exists (lines 27-34):

```tsx
        <div className="flex items-center gap-4">
          <Link href="/cleaners" className="text-sm text-gray-500 underline">
            Cleaners
          </Link>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-gray-500 underline">Log out</button>
          </form>
        </div>
```

Replace it with:

```tsx
        <div className="flex items-center gap-4">
          <Link href="/cleaners" className="text-sm text-gray-500 underline">
            Cleaners
          </Link>
          <Link href="/checklists" className="text-sm text-gray-500 underline">
            Checklists
          </Link>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-gray-500 underline">Log out</button>
          </form>
        </div>
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
npx tsc --noEmit
```

Expected: no errors in the new files.

- [ ] **Step 6: Verify end-to-end via the running dev server**

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
# Re-run Task 0 Step 2 to get a fresh $TOKEN and reuse $HOST_ID from Task 0 Step 3.

TEMPLATE_ID=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_templates" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"host_id\":\"$HOST_ID\",\"room_type\":\"Kitchen\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id))")
echo "template: $TEMPLATE_ID"

curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_template_items" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"template_id\":\"$TEMPLATE_ID\",\"label\":\"Refrigerator\",\"sort_order\":0}"
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_template_items" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"template_id\":\"$TEMPLATE_ID\",\"label\":\"Countertops\",\"sort_order\":1}"

curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_template_items?select=label&template_id=eq.$TEMPLATE_ID&order=sort_order"
```

Expected: `[{"label":"Refrigerator"},{"label":"Countertops"}]`. Keep this template — Task 4's verification reuses it.

- [ ] **Step 7: Commit**

```bash
git add app/checklists app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat: add checklist templates management page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Auto-fill new zones from a matching template

**Files:**
- Modify: `app/properties/[id]/ZoneManager.tsx`

**Interfaces:**
- Consumes: `checklist_templates`/`checklist_template_items` tables from Task 1; the "Kitchen" template created in Task 3's verification.
- Produces: after `addZone` runs, matching new zones get `zone_checklist_items` rows copied from the template. No other task depends on this function directly.

- [ ] **Step 1: Read the current `addZone` function**

Open `app/properties/[id]/ZoneManager.tsx` and locate the `addZone` function (currently inserts into `zones` then resets form state and calls `router.refresh()`).

- [ ] **Step 2: Modify `addZone` to copy a matching template's items**

Replace the body of `addZone` (the part after the `zones` insert) with template lookup + copy logic. The insert needs `.select().single()` now to get the new zone's id back:

```tsx
  async function addZone(zoneName: string, extra?: { checklist?: string; requirePhoto?: boolean }) {
    if (!zoneName.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const { data: newZone } = await supabase
      .from("zones")
      .insert({
        property_id: propertyId,
        name: zoneName,
        checklist_items: extra?.checklist || null,
        require_photo: extra?.requirePhoto ?? false,
      })
      .select("id")
      .single();

    if (newZone) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: templates } = await supabase
        .from("checklist_templates")
        .select("id, room_type, checklist_template_items ( label, sort_order )")
        .eq("host_id", user!.id);

      const match = templates?.find(
        (t) => t.room_type.toLowerCase() === zoneName.trim().toLowerCase()
      );
      if (match && match.checklist_template_items.length > 0) {
        await supabase.from("zone_checklist_items").insert(
          match.checklist_template_items.map((item) => ({
            zone_id: newZone.id,
            label: item.label,
            sort_order: item.sort_order,
          }))
        );
      }
    }

    setName("");
    setChecklist("");
    setRequirePhoto(false);
    setExpanded(false);
    setLoading(false);
    router.refresh();
  }
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
npx tsc --noEmit
```

Expected: no errors in `ZoneManager.tsx`.

- [ ] **Step 4: Verify the copy behavior directly (proxy for the UI calling the same operations)**

This reproduces exactly what `addZone` now does, using the "Kitchen" template from Task 3's verification and `$PROPERTY_ID` from Task 0:

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
# Re-run Task 0 Step 2 for a fresh $TOKEN; reuse $PROPERTY_ID from Task 0 and $TEMPLATE_ID from Task 3.

ZONE_ID=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/zones" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"property_id\":\"$PROPERTY_ID\",\"name\":\"Kitchen\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id))")
echo "zone: $ZONE_ID"

ITEMS=$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_template_items?select=label,sort_order&template_id=eq.$TEMPLATE_ID")
echo "template items: $ITEMS"

# Simulate the copy (what addZone's code now does):
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/zone_checklist_items" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"zone_id\":\"$ZONE_ID\",\"label\":\"Refrigerator\",\"sort_order\":0}"
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/zone_checklist_items" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"zone_id\":\"$ZONE_ID\",\"label\":\"Countertops\",\"sort_order\":1}"

curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/zone_checklist_items?select=label&zone_id=eq.$ZONE_ID&order=sort_order"
```

Expected final line: `[{"label":"Refrigerator"},{"label":"Countertops"}]`.

- [ ] **Step 5: Manually confirm in-browser**

Start the dev server (`npm run dev -- -p 3002`), log in as your real host account, open a property, type "Kitchen" as a new zone name (matching your real template if you've made one, or make one at `/checklists` first), and confirm the new zone's checklist (visible once Task 5 is done) shows the template's items pre-filled.

- [ ] **Step 6: Commit**

```bash
git add app/properties/\[id\]/ZoneManager.tsx
git commit -m "$(cat <<'EOF'
feat: auto-fill new zones from a matching checklist template

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Zone checklist editor on the property page

**Files:**
- Create: `app/properties/[id]/ZoneChecklist.tsx`
- Modify: `app/properties/[id]/page.tsx`

**Interfaces:**
- Consumes: `ChecklistItemsEditor` from Task 2; `zone_checklist_items` table from Task 1.
- Produces: `<ZoneChecklist zoneId zoneName items />` client component, rendered inside each zone row in `page.tsx`. Task 7 extends the same zone row for the item-count badge — that task should render alongside, not replace, this component.

- [ ] **Step 1: Write `app/properties/[id]/ZoneChecklist.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ChecklistItemsEditor from "@/components/ChecklistItemsEditor";

export default function ZoneChecklist({
  zoneId,
  zoneName,
  items,
}: {
  zoneId: string;
  zoneName: string;
  items: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleAdd(label: string) {
    const supabase = createClient();
    await supabase.from("zone_checklist_items").insert({
      zone_id: zoneId,
      label,
      sort_order: items.length,
    });
    router.refresh();
  }

  async function handleEdit(id: string, label: string) {
    const supabase = createClient();
    await supabase.from("zone_checklist_items").update({ label }).eq("id", id);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("zone_checklist_items").delete().eq("id", id);
    router.refresh();
  }

  async function handleSaveAsTemplate() {
    if (items.length === 0) {
      alert("Add at least one item before saving this as a template.");
      return;
    }
    if (
      !confirm(
        `Save these ${items.length} items as your "${zoneName}" template? This replaces that template's current items (if any). Existing zones are not affected.`
      )
    ) {
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: template } = await supabase
      .from("checklist_templates")
      .upsert(
        { host_id: user!.id, room_type: zoneName },
        { onConflict: "host_id,room_type" }
      )
      .select("id")
      .single();

    if (template) {
      await supabase.from("checklist_template_items").delete().eq("template_id", template.id);
      await supabase.from("checklist_template_items").insert(
        items.map((item, i) => ({
          template_id: template.id,
          label: item.label,
          sort_order: i,
        }))
      );
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-500 underline"
      >
        Checklist ({items.length})
      </button>
      {open && (
        <div className="mt-2 border rounded-lg p-3 bg-gray-50 text-gray-900">
          <ChecklistItemsEditor items={items} onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete} />
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            disabled={saving}
            className="text-xs text-gray-500 hover:text-gray-900 mt-3 disabled:opacity-50"
          >
            {saving ? "Saving..." : `Save as ${zoneName} template`}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `app/properties/[id]/page.tsx`**

First, fetch each zone's items alongside the existing zone query. Find the existing zones query:

```tsx
  const { data: zones } = await supabase
    .from("zones")
    .select("id, name, task_description, checklist_items, require_photo, sort_order")
    .eq("property_id", id)
    .order("sort_order", { ascending: true });
```

Change it to also fetch `zone_checklist_items`:

```tsx
  const { data: zones } = await supabase
    .from("zones")
    .select(
      "id, name, task_description, checklist_items, require_photo, sort_order, zone_checklist_items ( id, label, sort_order )"
    )
    .eq("property_id", id)
    .order("sort_order", { ascending: true });
```

Then add the import:

```tsx
import ZoneChecklist from "./ZoneChecklist";
```

The zone row currently looks like this (exact current content, including the `DeleteZoneButton` from earlier delete-feature work):

```tsx
            <div
              key={zone.id}
              className="border rounded-lg px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={`${zone.name} photo`}
                    className="w-10 h-10 rounded object-cover border shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {zone.name}
                    {zone.require_photo && (
                      <span className="text-[10px] text-gray-400 border rounded-full px-1.5 py-0.5">
                        photo required
                      </span>
                    )}
                  </p>
                  {zone.task_description && (
                    <p className="text-xs text-gray-500">{zone.task_description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {activeSession && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      done ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {done ? "Done" : "Pending"}
                  </span>
                )}
                <DeleteZoneButton zoneId={zone.id} zoneName={zone.name} />
              </div>
            </div>
```

Replace it with this — the outer `<div>` drops `flex items-center justify-between gap-3` (now stacking two children instead of laying out one row), the previous flex content moves into a new inner wrapper `<div className="flex items-center justify-between gap-3">`, and `<ZoneChecklist>` is added as a sibling after it:

```tsx
            <div key={zone.id} className="border rounded-lg px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt={`${zone.name} photo`}
                      className="w-10 h-10 rounded object-cover border shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium flex items-center gap-2">
                      {zone.name}
                      {zone.require_photo && (
                        <span className="text-[10px] text-gray-400 border rounded-full px-1.5 py-0.5">
                          photo required
                        </span>
                      )}
                    </p>
                    {zone.task_description && (
                      <p className="text-xs text-gray-500">{zone.task_description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {activeSession && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        done ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {done ? "Done" : "Pending"}
                    </span>
                  )}
                  <DeleteZoneButton zoneId={zone.id} zoneName={zone.name} />
                </div>
              </div>
              <ZoneChecklist
                zoneId={zone.id}
                zoneName={zone.name}
                items={(zone.zone_checklist_items ?? [])
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((i) => ({ id: i.id, label: i.label }))}
              />
            </div>
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
npx tsc --noEmit
```

Expected: no errors in `ZoneChecklist.tsx` or `page.tsx`.

- [ ] **Step 4: Verify "Save as template" logic directly**

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
# Re-run Task 0 Step 2 for a fresh $TOKEN; reuse $ZONE_ID from Task 4's verification (the "Kitchen" zone).

# Simulate handleSaveAsTemplate: upsert template, replace its items with the zone's current items.
TEMPLATE_ID2=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_templates" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: resolution=merge-duplicates,return=representation" \
  -d "{\"host_id\":\"$HOST_ID\",\"room_type\":\"Kitchen\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id))")
echo "template: $TEMPLATE_ID2"

curl -s -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_template_items?template_id=eq.$TEMPLATE_ID2" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_template_items" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"template_id\":\"$TEMPLATE_ID2\",\"label\":\"Sink\",\"sort_order\":0}"

curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_template_items?select=label&template_id=eq.$TEMPLATE_ID2"
```

Expected: `[{"label":"Sink"}]` — confirms upsert-then-replace works (this template previously had "Refrigerator"/"Countertops" from Task 3's verification; it's now fully replaced with just "Sink", matching the "replace, don't merge" behavior specified in the design).

- [ ] **Step 5: Manually confirm in-browser**

On the property page, expand a zone's "Checklist" section, add/edit/delete a couple items, and confirm they persist after the page refreshes.

- [ ] **Step 6: Commit**

```bash
git add app/properties/\[id\]/ZoneChecklist.tsx app/properties/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat: add per-zone checklist editor with save-as-template

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Cleaner-facing checkboxes and server-side gating

**Files:**
- Modify: `app/api/scan-session/route.ts`
- Create: `app/api/scan-item/route.ts`
- Modify: `app/api/scan/route.ts`
- Modify: `app/scan/[zoneId]/ScanClient.tsx`
- Modify: `app/scan/[zoneId]/ScanForm.tsx`

**Interfaces:**
- Consumes: `zone_checklist_items`, `scan_item_completions` tables from Task 1.
- Produces: `/api/scan-session` response gains `zone.checklist: {id, label, completed}[]`; new `POST /api/scan-item` body `{sessionId, itemId, completed}` returns `{ok: true}`; `/api/scan` now returns `400` with `{error: "N items still need to be checked off"}` if the zone has unchecked items.

- [ ] **Step 1: Extend `app/api/scan-session/route.ts` to return checklist state**

Read the current file first. After the existing `activeSession` query, add a checklist fetch and attach it to the response's `zone` object:

```tsx
  const { data: checklistItems } = await supabase
    .from("zone_checklist_items")
    .select("id, label, sort_order")
    .eq("zone_id", zoneId)
    .order("sort_order", { ascending: true });

  let completedIds = new Set<string>();
  if (activeSession) {
    const { data: completions } = await supabase
      .from("scan_item_completions")
      .select("item_id")
      .eq("session_id", activeSession.id);
    completedIds = new Set((completions ?? []).map((c) => c.item_id));
  }

  const checklist = (checklistItems ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    completed: completedIds.has(item.id),
  }));
```

The final `NextResponse.json({...})` call's `zone` object currently includes a `checklist_items: zone.checklist_items,` line (the old free-text field). Replace that one line with `checklist,` (the new structured array) — every other field in that object (`id`, `name`, `task_description`, `require_photo`, `property_name`) stays unchanged:

```tsx
      checklist,
```

- [ ] **Step 2: Write `app/api/scan-item/route.ts`**

```tsx
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Public route — cleaners have no auth session. Validates the item actually
// belongs to a zone whose property has this session active, same defense-in-depth
// pattern as /api/scan.
export async function POST(req: NextRequest) {
  const { sessionId, itemId, completed } = await req.json();
  if (!sessionId || !itemId || typeof completed !== "boolean") {
    return NextResponse.json({ error: "Missing sessionId, itemId, or completed" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: item } = await supabase
    .from("zone_checklist_items")
    .select("id, zone_id, zones ( property_id )")
    .eq("id", itemId)
    .single();

  const { data: session } = await supabase
    .from("turnover_sessions")
    .select("id, property_id, status")
    .eq("id", sessionId)
    .single();

  const itemPropertyId = (item?.zones as unknown as { property_id: string } | null)?.property_id;

  if (!item || !session || session.property_id !== itemPropertyId) {
    return NextResponse.json({ error: "Item/session mismatch" }, { status: 400 });
  }
  if (session.status !== "in_progress") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  if (completed) {
    await supabase
      .from("scan_item_completions")
      .upsert({ session_id: sessionId, item_id: itemId }, { onConflict: "session_id,item_id" });
  } else {
    await supabase
      .from("scan_item_completions")
      .delete()
      .eq("session_id", sessionId)
      .eq("item_id", itemId);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Harden `app/api/scan/route.ts`**

Read the current file. After the existing `zone.require_photo` check, add a checklist completeness check before the photo upload/upsert logic:

```tsx
  const { data: checklistItems } = await supabase
    .from("zone_checklist_items")
    .select("id")
    .eq("zone_id", zoneId);

  if (checklistItems && checklistItems.length > 0) {
    const { data: completions } = await supabase
      .from("scan_item_completions")
      .select("item_id")
      .eq("session_id", sessionId)
      .in("item_id", checklistItems.map((i) => i.id));

    const remaining = checklistItems.length - (completions?.length ?? 0);
    if (remaining > 0) {
      return NextResponse.json(
        { error: `${remaining} checklist item${remaining === 1 ? "" : "s"} still need${remaining === 1 ? "s" : ""} to be checked off` },
        { status: 400 }
      );
    }
  }
```

- [ ] **Step 4: Update `app/scan/[zoneId]/ScanClient.tsx` to render checkboxes**

The `SessionData` type's `zone` field currently includes `checklist_items: string | null;`. Replace that line with `checklist: { id: string; label: string; completed: boolean }[];`.

Replace the existing checklist-rendering `<ul>` block (the one mapping over `zone.checklist_items.split("\n")`) with:

```tsx
      {zone.checklist.length > 0 && (
        <ul className="mt-3 space-y-2">
          {zone.checklist.map((item) => (
            <li key={item.id}>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    await fetch("/api/scan-item", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sessionId: activeSession?.id,
                        itemId: item.id,
                        completed: checked,
                      }),
                    });
                    load();
                  }}
                />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
      )}
```

(This replaces the old plain-text `checklist_items` bullet rendering — remove that old block entirely, since checklist items are now structured. The `task_description` block above it stays unchanged.)

- [ ] **Step 5: Pass completion status into `ScanForm` and gate "Mark done"**

In `ScanClient.tsx`, where `<ScanForm>` is rendered, add a new prop:

```tsx
            <ScanForm
              zoneId={zone.id}
              sessionId={activeSession.id}
              cleanerId={cleaner.id}
              requirePhoto={zone.require_photo}
              allItemsChecked={zone.checklist.every((i) => i.completed)}
            />
```

In `app/scan/[zoneId]/ScanForm.tsx`, add the prop to the type signature and use it:

```tsx
export default function ScanForm({
  zoneId,
  sessionId,
  cleanerId,
  requirePhoto,
  allItemsChecked,
}: {
  zoneId: string;
  sessionId: string;
  cleanerId: string;
  requirePhoto?: boolean;
  allItemsChecked: boolean;
}) {
```

The file currently ends with this exact block:

```tsx
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full bg-black text-white rounded py-3 font-medium disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting..." : "Mark done"}
      </button>
      {status === "error" && (
        <p className="text-red-600 text-sm">Something went wrong — try again.</p>
      )}
```

Replace it with (adds the hint paragraph and `allItemsChecked` to `disabled`; the trailing `status === "error"` paragraph is unchanged and must stay):

```tsx
      {!allItemsChecked && (
        <p className="text-xs text-amber-700">Check off every item above before marking this zone done.</p>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={status === "submitting" || !allItemsChecked}
        className="w-full bg-black text-white rounded py-3 font-medium disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting..." : "Mark done"}
      </button>
      {status === "error" && (
        <p className="text-red-600 text-sm">Something went wrong — try again.</p>
      )}
```

- [ ] **Step 6: Type-check**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
npx tsc --noEmit
```

Expected: no errors in any of the five modified/created files.

- [ ] **Step 7: Verify the full cleaner flow end-to-end via curl**

This mirrors the exact verification approach used successfully earlier in this project (see the "cleaner scan flow" testing done during initial development) — restart the dev server first so it picks up all changes:

```bash
cd /Users/alpaytonga/Desktop/turnover-app
lsof -ti:3002 | xargs kill 2>/dev/null; sleep 1
npm run dev -- -p 3002 > /tmp/turnover-dev.log 2>&1 &
sleep 3

set -a && source .env.local && set +a

# Reuse $ZONE_ID (the "Kitchen" zone with 2 items from Task 4) and its property/session setup.
# First, create a real turnover session and a cleaner for the test host (via service role, for setup speed):
SESSION_ID=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/turnover_sessions" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"property_id\":\"$PROPERTY_ID\",\"status\":\"in_progress\",\"job_started_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id))")
echo "session: $SESSION_ID"

ITEM_IDS=$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/zone_checklist_items?select=id&zone_id=eq.$ZONE_ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
echo "items: $ITEM_IDS"
```

Extract the two item ids from `$ITEM_IDS` output into `$ITEM1` and `$ITEM2` manually, then:

```bash
# Attempt to mark the zone done BEFORE checking any items — must be rejected:
curl -s -i -X POST http://localhost:3002/api/scan \
  -F "zoneId=$ZONE_ID" -F "sessionId=$SESSION_ID"
```

Expected: `HTTP/1.1 400` with body like `{"error":"2 checklist items still need to be checked off"}`.

```bash
# Check off both items via the new endpoint:
curl -s -X POST http://localhost:3002/api/scan-item \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"itemId\":\"$ITEM1\",\"completed\":true}"
curl -s -X POST http://localhost:3002/api/scan-item \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"itemId\":\"$ITEM2\",\"completed\":true}"

# Confirm scan-session now reports both as completed:
curl -s "http://localhost:3002/api/scan-session?zoneId=$ZONE_ID" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.zone.checklist)})"
```

Expected: both items show `"completed":true`.

```bash
# Now marking done should succeed:
curl -s -i -X POST http://localhost:3002/api/scan \
  -F "zoneId=$ZONE_ID" -F "sessionId=$SESSION_ID"
```

Expected: `HTTP/1.1 200` with `{"ok":true}`.

- [ ] **Step 8: Manually confirm in-browser (and on your phone)**

Log in as a cleaner on the zone's scan page, confirm checkboxes render and toggle instantly, "Mark done" stays disabled with an explanatory note until all are checked, then enables once they are.

- [ ] **Step 9: Commit**

```bash
git add app/api/scan-session/route.ts app/api/scan-item/route.ts app/api/scan/route.ts app/scan/\[zoneId\]/ScanClient.tsx app/scan/\[zoneId\]/ScanForm.tsx
git commit -m "$(cat <<'EOF'
feat: cleaner-facing checklist checkboxes with server-side completion gating

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Host-side per-item progress display

**Files:**
- Modify: `app/properties/[id]/page.tsx`

**Interfaces:**
- Consumes: `zone_checklist_items` (already fetched per zone as of Task 5), `scan_item_completions` table from Task 1.
- Produces: no new exports — this is the final task, purely additive UI in the existing zone row.

- [ ] **Step 1: Fetch completions for the active session**

Near the existing `activeSession` computation in `page.tsx`, add a fetch for item completions (only meaningful when there's an active session):

```tsx
  const { data: itemCompletions } = activeSession
    ? await supabase
        .from("scan_item_completions")
        .select("item_id")
        .eq("session_id", activeSession.id)
    : { data: [] as { item_id: string }[] };
  const completedItemIds = new Set((itemCompletions ?? []).map((c) => c.item_id));
```

- [ ] **Step 2: Show the count next to each zone's existing Pending/Done badge**

After Task 5, the zone row's badge section (inside the zone `.map()`) looks like this:

```tsx
                <div className="flex items-center gap-3 shrink-0">
                  {activeSession && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        done ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {done ? "Done" : "Pending"}
                    </span>
                  )}
                  <DeleteZoneButton zoneId={zone.id} zoneName={zone.name} />
                </div>
```

Add the item-count badge right after the closing `</span>` of the Pending/Done badge, still inside the same `activeSession && (...)` fragment — since JSX only allows one root per `{}`, wrap both in a fragment:

```tsx
                <div className="flex items-center gap-3 shrink-0">
                  {activeSession && (
                    <>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          done ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {done ? "Done" : "Pending"}
                      </span>
                      {(zone.zone_checklist_items?.length ?? 0) > 0 && (
                        <span className="text-xs text-gray-400">
                          {zone.zone_checklist_items!.filter((i) => completedItemIds.has(i.id)).length}/
                          {zone.zone_checklist_items!.length} items
                        </span>
                      )}
                    </>
                  )}
                  <DeleteZoneButton zoneId={zone.id} zoneName={zone.name} />
                </div>
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/alpaytonga/Desktop/turnover-app
npx tsc --noEmit
```

Expected: no errors in `page.tsx`.

- [ ] **Step 4: Verify the underlying data is correct**

Using `$SESSION_ID` and the two item ids from Task 6's verification (one was checked off there — reuse that state, or check off just one item this time to see a partial count):

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/scan_item_completions?select=item_id&session_id=eq.$SESSION_ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: an array with both item ids (both were checked off in Task 6's verification) — confirms the query `page.tsx` now runs would compute "2/2 items" for that zone.

- [ ] **Step 5: Manually confirm in-browser**

Log in as the host, open the property with an active turnover, and confirm each zone with checklist items shows e.g. "1/2 items" next to Pending/Done, updating automatically (via the existing `AutoRefresh` polling) as items get checked off on the cleaner's phone.

- [ ] **Step 6: Commit**

```bash
git add app/properties/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat: show per-item checklist progress on the host property page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Clean up test data

**Files:** none.

- [ ] **Step 1: Delete the disposable test host account and all its data**

```bash
set -a && source /Users/alpaytonga/Desktop/turnover-app/.env.local && set +a
# Deleting the auth.users row cascades to hosts -> properties -> zones -> zone_checklist_items,
# turnover_sessions -> scan_item_completions, and checklist_templates -> checklist_template_items,
# via the existing ON DELETE CASCADE foreign keys.
curl -s -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users/$HOST_ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `200` or `204` status, no error body.

- [ ] **Step 2: Confirm it's gone**

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/hosts?select=id&id=eq.$HOST_ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `[]`.

No commit needed — this task doesn't touch any files.
