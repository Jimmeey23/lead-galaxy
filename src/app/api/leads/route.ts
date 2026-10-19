import { NextResponse } from "next/server";
import { getLeads } from "@/lib/sheet";
import { applyFilters } from "@/lib/filters";
import { computeKpis } from "@/lib/metrics";
import type { FilterState, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  filters: FilterState;
  page?: number;
  pageSize?: number;
  sort?: { field: string; dir: "asc" | "desc" }[];
  groupBy?: string[];
  expanded?: string[];
  columnFilters?: Record<string, string>;
  aiFilter?: string;
};

const val = (l: Lead, f: string): string | number | null => {
  const rec = l as unknown as Record<string, unknown>;
  const v = rec[f];
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return null;
};

function sortRows(rows: Lead[], sort: Body["sort"]) {
  if (!sort?.length) return rows;
  return [...rows].sort((a, b) => {
    for (const s of sort) {
      const av = val(a, s.field);
      const bv = val(b, s.field);
      let c = 0;
      if (typeof av === "number" || typeof bv === "number")
        c = (Number(av ?? -Infinity) || 0) - (Number(bv ?? -Infinity) || 0);
      else c = String(av ?? "").localeCompare(String(bv ?? ""));
      if (c) return s.dir === "asc" ? c : -c;
    }
    return 0;
  });
}

function summarise(rows: Lead[]) {
  const k = computeKpis(rows);
  return {
    leads: k.totalLeads,
    converted: k.converted,
    conversionRate: k.conversionRate,
    purchases: k.purchases,
    ltv: k.totalLtv,
    avgLtv: k.avgLtvPerLead,
    visits: k.visits,
    trials: k.trials,
  };
}

type GroupNode = {
  path: string;
  label: string;
  field: string;
  depth: number;
  summary: ReturnType<typeof summarise>;
  children?: GroupNode[];
  leads?: Lead[];
};

function buildGroups(rows: Lead[], fields: string[], depth: number, parent: string): GroupNode[] {
  const field = fields[depth];
  const map = new Map<string, Lead[]>();
  for (const l of rows) {
    const key = String(val(l, field) ?? "") || "(blank)";
    const a = map.get(key);
    if (a) a.push(l);
    else map.set(key, [l]);
  }
  return [...map.entries()]
    .map(([label, group]) => {
      const path = parent ? `${parent}||${label}` : label;
      const node: GroupNode = {
        path,
        label,
        field,
        depth,
        summary: summarise(group),
      };
      if (depth + 1 < fields.length) node.children = buildGroups(group, fields, depth + 1, path);
      else node.leads = group.slice(0, 200);
      return node;
    })
    .sort((a, b) => b.summary.leads - a.summary.leads);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const cache = await getLeads();
  if (cache.error && !cache.leads.length)
    return NextResponse.json({ error: cache.error }, { status: 502 });

  let rows = applyFilters(cache.leads, body.filters);
  // AI-driven quick filters
  if (body.aiFilter && body.aiFilter !== "all") {
    const { cadenceForLead } = await import("@/lib/ai");
    const { getCadence } = await import("@/lib/cadence");
    const cfg = await getCadence();
    if (body.aiFilter === "overdue") rows = rows.filter((l) => { const c = cadenceForLead(l, undefined, cfg); return c.status === "overdue"; });
    else if (body.aiFilter === "missed") rows = rows.filter((l) => { const c = cadenceForLead(l, undefined, cfg); return c.status === "missed" || c.status === "overdue"; });
    else if (body.aiFilter === "opportunities") rows = rows.filter((l) => { const c = cadenceForLead(l, undefined, cfg); return !l.converted && c.opportunityScore >= 70; });
  }
  const cf = body.columnFilters ?? {};
  for (const [field, q] of Object.entries(cf)) {
    const needle = q.trim().toLowerCase();
    if (!needle) continue;
    rows = rows.filter((l) => String(val(l, field) ?? "").toLowerCase().includes(needle));
  }
  rows = sortRows(rows, body.sort);

  if (body.groupBy?.length) {
    return NextResponse.json({
      mode: "grouped",
      total: rows.length,
      summary: summarise(rows),
      groups: buildGroups(rows, body.groupBy.slice(0, 4), 0, ""),
    });
  }

  const pageSize = Math.min(body.pageSize ?? 50, 500);
  const page = Math.max(1, body.page ?? 1);
  const start = (page - 1) * pageSize;
  return NextResponse.json({
    mode: "flat",
    total: rows.length,
    page,
    pageSize,
    summary: summarise(rows),
    rows: rows.slice(start, start + pageSize),
  });
}
