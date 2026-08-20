import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import TurnoverRow from "./TurnoverRow";
import TzHiddenInput from "./TzHiddenInput";
import AppNav from "@/app/components/AppNav";

const PAGE_SIZE = 20;
const SUMMARY_CAP = 500;

type ChecklistItem = { id: string; label: string };
type Zone = { slug: string; name: string; zone_checklist_items: ChecklistItem[] };
type ScanEvent = {
  zone_slug: string;
  scanned_at: string;
  scan_event_photos: { photo_url: string }[];
  cleaners: { name: string } | null;
};

type SessionRow = {
  id: string;
  property_id: string;
  started_at: string;
  job_started_at: string | null;
  job_finished_at: string | null;
  properties: {
    id: string;
    name: string;
  } | null;
  cleaners: { name: string } | null;
  scan_item_completions: { item_id: string }[] | null;
  scan_events: ScanEvent[] | null;
};

function computeScore(
  s: Pick<SessionRow, "property_id" | "scan_item_completions">,
  totalItemsByProperty: Map<string, number>
) {
  const totalItems = totalItemsByProperty.get(s.property_id) ?? 0;
  if (totalItems === 0) return null;
  const completed = s.scan_item_completions?.length ?? 0;
  return Math.round((Math.min(completed, totalItems) / totalItems) * 100);
}

function computeDurationMinutes(s: Pick<SessionRow, "job_started_at" | "job_finished_at">) {
  if (!s.job_started_at || !s.job_finished_at) return null;
  return Math.round(
    (new Date(s.job_finished_at).getTime() - new Date(s.job_started_at).getTime()) / 60000
  );
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// The From/To date filters are calendar dates in the viewer's own timezone,
// but started_at is stored in UTC — comparing the raw date string against it
// shifts the boundary by the viewer's UTC offset (e.g. "Aug 15 local" can be
// "Aug 16 UTC"). Converts a local YYYY-MM-DD + time-of-day into the matching
// UTC instant, given an IANA timezone name (falls back to UTC if unknown/absent).
function localDateToUtcIso(
  dateStr: string,
  tz: string | undefined,
  time: { hour: number; minute: number; second: number }
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!tz) {
    return new Date(Date.UTC(y, m - 1, d, time.hour, time.minute, time.second)).toISOString();
  }
  const guessUtc = new Date(Date.UTC(y, m - 1, d, time.hour, time.minute, time.second));
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(guessUtc).reduce(
      (acc, p) => {
        acc[p.type] = p.value;
        return acc;
      },
      {} as Record<string, string>
    );
    const asIfUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    );
    const offsetMs = asIfUtc - guessUtc.getTime();
    return new Date(guessUtc.getTime() - offsetMs).toISOString();
  } catch {
    return guessUtc.toISOString();
  }
}

// Groups sessions into relative-time buckets for display. Boundaries use the
// server's clock (UTC) for simplicity — off by a few hours at the edges of a
// bucket, which only affects which *heading* a turnover falls under, not the
// exact time shown on the row (that's rendered client-side via LocalTime).
function bucketLabel(startedAt: string, now: Date): string {
  const d = new Date(startedAt);
  const startOfDay = (x: Date) => {
    const y = new Date(x);
    y.setUTCHours(0, 0, 0, 0);
    return y;
  };
  const today = startOfDay(now);
  const dayOfWeek = (today.getUTCDay() + 6) % 7; // 0 = Monday
  const thisWeekStart = new Date(today);
  thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - dayOfWeek);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  if (d >= today) return "Today";
  if (d >= thisWeekStart) return "This Week";
  if (d >= lastWeekStart) return "Last Week";
  if (d >= thisMonthStart) return "This Month";
  if (d >= lastMonthStart) return "Last Month";
  if (d >= yearStart) return "Earlier This Year";
  return String(d.getUTCFullYear());
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    cleaner?: string;
    from?: string;
    to?: string;
    page?: string;
    tz?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: properties }, { data: cleaners }] = await Promise.all([
    supabase.from("properties").select("id, name").eq("host_id", user!.id).order("name"),
    supabase.from("cleaners").select("id, name").eq("host_id", user!.id).order("name"),
  ]);
  const ownPropertyIds = (properties ?? []).map((p) => p.id);

  const pageNum = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  function applyFilters<T>(query: T): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = query as any;
    q = q.in("property_id", ownPropertyIds);
    if (params.property) q = q.eq("property_id", params.property);
    if (params.cleaner) q = q.eq("cleaner_id", params.cleaner);
    if (params.from) {
      q = q.gte("started_at", localDateToUtcIso(params.from, params.tz, { hour: 0, minute: 0, second: 0 }));
    }
    if (params.to) {
      q = q.lte("started_at", localDateToUtcIso(params.to, params.tz, { hour: 23, minute: 59, second: 59 }));
    }
    return q;
  }

  // Checklist item totals per property, and per-(property, zone) item lists —
  // fetched once up front for every property this host owns, reused for both
  // the score computation and each row's expanded per-zone breakdown.
  const { data: allChecklistItems } =
    ownPropertyIds.length > 0
      ? await supabase
          .from("zone_checklist_items")
          .select("id, property_id, zone_slug, label")
          .in("property_id", ownPropertyIds)
      : { data: [] as { id: string; property_id: string; zone_slug: string; label: string }[] };

  const totalItemsByProperty = new Map<string, number>();
  const checklistItemsByPropertyZone = new Map<string, ChecklistItem[]>();
  for (const item of allChecklistItems ?? []) {
    totalItemsByProperty.set(item.property_id, (totalItemsByProperty.get(item.property_id) ?? 0) + 1);
    const key = `${item.property_id}:${item.zone_slug}`;
    const arr = checklistItemsByPropertyZone.get(key) ?? [];
    arr.push({ id: item.id, label: item.label });
    checklistItemsByPropertyZone.set(key, arr);
  }

  const { data: allClaims } =
    ownPropertyIds.length > 0
      ? await supabase
          .from("property_set_claims")
          .select("property_id, set_id")
          .in("property_id", ownPropertyIds)
          .is("released_at", null)
      : { data: [] as { property_id: string; set_id: string }[] };
  const setIdByProperty = new Map((allClaims ?? []).map((c) => [c.property_id, c.set_id]));
  const allSetIds = Array.from(new Set((allClaims ?? []).map((c) => c.set_id)));

  const { data: allSetZones } =
    allSetIds.length > 0
      ? await supabase
          .from("qr_set_zones")
          .select("set_id, zone_slug, zone_label, sort_order")
          .in("set_id", allSetIds)
          .order("sort_order", { ascending: true })
      : { data: [] as { set_id: string; zone_slug: string; zone_label: string; sort_order: number }[] };
  const setZonesBySet = new Map<string, { zone_slug: string; zone_label: string }[]>();
  for (const z of allSetZones ?? []) {
    const arr = setZonesBySet.get(z.set_id) ?? [];
    arr.push({ zone_slug: z.zone_slug, zone_label: z.zone_label });
    setZonesBySet.set(z.set_id, arr);
  }

  function zonesForProperty(propertyId: string): Zone[] {
    const setId = setIdByProperty.get(propertyId);
    if (!setId) return [];
    return (setZonesBySet.get(setId) ?? []).map((z) => ({
      slug: z.zone_slug,
      name: z.zone_label,
      zone_checklist_items: checklistItemsByPropertyZone.get(`${propertyId}:${z.zone_slug}`) ?? [],
    }));
  }

  const listQuery = applyFilters(
    supabase
      .from("turnover_sessions")
      .select(
        `id, property_id, started_at, job_started_at, job_finished_at,
         properties ( id, name ),
         cleaners ( name ),
         scan_item_completions ( item_id ),
         scan_events ( zone_slug, scanned_at, cleaners ( name ), scan_event_photos ( photo_url ) )`,
        { count: "exact" }
      )
      .eq("status", "complete")
      .order("started_at", { ascending: false })
      .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1)
  );
  const { data: sessions, count, error: listError } = await listQuery;
  if (listError) {
    console.error("History list query failed:", listError);
  }

  const summaryQuery = applyFilters(
    supabase
      .from("turnover_sessions")
      .select(`property_id, job_started_at, job_finished_at, scan_item_completions ( item_id )`)
      .eq("status", "complete")
      .order("started_at", { ascending: false })
      .limit(SUMMARY_CAP)
  );
  const { data: summarySessions } = await summaryQuery;

  const scores = (summarySessions ?? [])
    .map((s) => computeScore(s as unknown as SessionRow, totalItemsByProperty))
    .filter((n): n is number => n !== null);
  const durations = (summarySessions ?? [])
    .map((s) => computeDurationMinutes(s as unknown as SessionRow))
    .filter((n): n is number => n !== null);
  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const avgDuration =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rows = (sessions ?? []) as unknown as SessionRow[];

  const now = new Date();
  const groups: { label: string; rows: SessionRow[] }[] = [];
  for (const row of rows) {
    const label = bucketLabel(row.started_at, now);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.rows.push(row);
    } else {
      groups.push({ label, rows: [row] });
    }
  }

  function buildPageHref(page: number) {
    const qs = new URLSearchParams();
    if (params.property) qs.set("property", params.property);
    if (params.cleaner) qs.set("cleaner", params.cleaner);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.tz) qs.set("tz", params.tz);
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return s ? `/history?${s}` : "/history";
  }

  return (
    <>
      <AppNav current="/history" />
      <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mt-2 mb-6">Turnover history</h1>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border rounded-lg p-3">
          <p className="text-xs text-gray-500">Turnovers completed</p>
          <p className="text-xl font-semibold mt-1">{totalCount}</p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-gray-500">Average clean score</p>
          <p className="text-xl font-semibold mt-1">{avgScore !== null ? `${avgScore}%` : "—"}</p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-gray-500">Average duration</p>
          <p className="text-xl font-semibold mt-1">
            {avgDuration !== null ? formatDuration(avgDuration) : "—"}
          </p>
        </div>
      </div>
      {totalCount > SUMMARY_CAP && (
        <p className="text-xs text-gray-400 -mt-4 mb-6">
          Averages are based on the {SUMMARY_CAP} most recent matching turnovers.
        </p>
      )}

      <form method="get" className="border rounded-lg p-4 mb-6 grid gap-3 sm:grid-cols-4">
        <TzHiddenInput defaultValue={params.tz ?? ""} />
        <label className="block">
          <span className="text-xs text-gray-500">Property</span>
          <select
            name="property"
            defaultValue={params.property ?? ""}
            className="w-full border rounded px-2 py-2 text-sm mt-1 bg-white text-gray-900"
          >
            <option value="">All properties</option>
            {properties?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Cleaner</span>
          <select
            name="cleaner"
            defaultValue={params.cleaner ?? ""}
            className="w-full border rounded px-2 py-2 text-sm mt-1 bg-white text-gray-900"
          >
            <option value="">All cleaners</option>
            {cleaners?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">From</span>
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="w-full border rounded px-2 py-2 text-sm mt-1 bg-white text-gray-900"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">To</span>
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="w-full border rounded px-2 py-2 text-sm mt-1 bg-white text-gray-900"
          />
        </label>
        <div className="sm:col-span-4 flex gap-2">
          <button type="submit" className="bg-black text-white text-sm rounded px-4 py-2">
            Apply filters
          </button>
          {(params.property || params.cleaner || params.from || params.to) && (
            <Link href="/history" className="text-sm text-gray-500 underline self-center">
              Clear
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 && (
        <p className="text-gray-500 text-sm">No completed turnovers match these filters yet.</p>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="text-sm font-medium text-gray-500 mb-2">{group.label}</h2>
            <div className="space-y-2">
              {group.rows.map((s) => {
                const score = computeScore(s, totalItemsByProperty);
                const durationMin = computeDurationMinutes(s);
                return (
                  <TurnoverRow
                    key={s.id}
                    sessionId={s.id}
                    propertyId={s.properties?.id ?? ""}
                    propertyName={s.properties?.name ?? "Unknown property"}
                    cleanerName={s.cleaners?.name ?? null}
                    startedAt={s.started_at}
                    durationLabel={durationMin !== null ? formatDuration(durationMin) : null}
                    score={score}
                    zones={zonesForProperty(s.property_id)}
                    scanRecords={s.scan_events ?? []}
                    completedItemIds={new Set((s.scan_item_completions ?? []).map((c) => c.item_id))}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm">
          {pageNum > 1 ? (
            <Link href={buildPageHref(pageNum - 1)} className="underline text-gray-500">
              &larr; Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-gray-400 text-xs">
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages ? (
            <Link href={buildPageHref(pageNum + 1)} className="underline text-gray-500">
              Next &rarr;
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
      </div>
    </>
  );
}
