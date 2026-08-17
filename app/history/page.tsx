import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import LocalTime from "@/app/properties/[id]/LocalTime";

const PAGE_SIZE = 20;
const SUMMARY_CAP = 500;

type SessionRow = {
  id: string;
  started_at: string;
  job_started_at: string | null;
  job_finished_at: string | null;
  properties: {
    id: string;
    name: string;
    zones: { zone_checklist_items: { id: string }[] }[];
  } | null;
  cleaners: { name: string } | null;
  scan_item_completions: { id: string }[] | null;
};

function computeScore(s: Pick<SessionRow, "properties" | "scan_item_completions">) {
  const totalItems = (s.properties?.zones ?? []).reduce(
    (sum, z) => sum + (z.zone_checklist_items?.length ?? 0),
    0
  );
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
    if (params.from) q = q.gte("started_at", params.from);
    if (params.to) q = q.lte("started_at", `${params.to}T23:59:59`);
    return q;
  }

  const listQuery = applyFilters(
    supabase
      .from("turnover_sessions")
      .select(
        `id, started_at, job_started_at, job_finished_at,
         properties ( id, name, zones ( zone_checklist_items ( id ) ) ),
         cleaners ( name ),
         scan_item_completions ( id )`,
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
      .select(
        `job_started_at, job_finished_at,
         properties ( zones ( zone_checklist_items ( id ) ) ),
         scan_item_completions ( id )`
      )
      .eq("status", "complete")
      .order("started_at", { ascending: false })
      .limit(SUMMARY_CAP)
  );
  const { data: summarySessions } = await summaryQuery;

  const scores = (summarySessions ?? [])
    .map((s) => computeScore(s as unknown as SessionRow))
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
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return s ? `/history?${s}` : "/history";
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-gray-500 underline">
          &larr; Dashboard
        </Link>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-gray-500 underline">Log out</button>
        </form>
      </div>

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

      <p className="text-xs text-gray-400 mb-3">
        Debug — ownPropertyIds: {JSON.stringify(ownPropertyIds)}, count: {String(count)}, rows:{" "}
        {rows.length}
      </p>
      {listError && (
        <p className="text-red-600 text-sm mb-3">
          Debug — query error: {listError.message}
        </p>
      )}
      {rows.length === 0 && !listError && (
        <p className="text-gray-500 text-sm">No completed turnovers match these filters yet.</p>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="text-sm font-medium text-gray-500 mb-2">{group.label}</h2>
            <div className="space-y-2">
              {group.rows.map((s) => {
                const score = computeScore(s);
                const durationMin = computeDurationMinutes(s);
                return (
                  <Link
                    key={s.id}
                    href={`/properties/${s.properties?.id}`}
                    className="block border rounded-lg px-4 py-3 text-sm hover:bg-gray-50 hover:text-gray-900"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{s.properties?.name ?? "Unknown property"}</p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          <LocalTime
                            iso={s.started_at}
                            options={{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }}
                          />
                          {" · "}
                          {s.cleaners?.name ?? "No cleaner recorded"}
                          {durationMin !== null ? ` · ${formatDuration(durationMin)}` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                          score === null
                            ? "bg-gray-100 text-gray-500"
                            : score >= 90
                              ? "bg-green-100 text-green-800"
                              : score >= 60
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
                        {score !== null ? `${score}% clean score` : "Complete"}
                      </span>
                    </div>
                  </Link>
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
  );
}
