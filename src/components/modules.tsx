"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bot,
  Info,
  Lightbulb,
  ShieldAlert,
  TrendingUp,
  Zap,
  Timer,
  Target,
  Activity,
  Users,
  Building2,
  Wallet,
  Phone,
  Eye,
} from "lucide-react";
import { Button, Card, Chip, EmptyState, GraphicKpi, Kpi, MultiSelect, Select, Skeleton, StatBar, Toggle, IconBadge, SectionHeader } from "./ui";
import { BarRank, DonutChart, PALETTE, ScatterPlot, TrendChart } from "./charts";
import { cx, days, inr, inrCompact, num, pctStr } from "@/lib/format";
import type { GroupRow, Insight, Kpis } from "@/lib/metrics";
import type { FilterState, CrossSheetMeta } from "@/lib/types";

export type Analytics = {
  meta: { syncedAt: string | null; totalRows: number; filteredRows: number; range: { from: string | null; to: string | null }; error: string | null; crossSheet: CrossSheetMeta | null; cadence?: import("@/lib/cadence-config").CadenceConfig };
  kpis: Kpis;
  compare: { range: { from: string | null; to: string | null }; kpis: Kpis } | null;
  series: { date: string; leads: number; converted: number; trials: number; ltv: number; conversionRate: number }[];
  funnel: { stage: string; value: number; ofTotal: number; stepRate: number; dropOff: number }[];
  groups: Record<string, GroupRow[]>;
  ltvBands: { key: string; leads: number }[];
  timeToConv: { key: string; leads: number }[];
  followUp: {
    buckets: { key: string; leads: number; converted: number; conversionRate: number; ltv: number }[];
    speed: { key: string; leads: number; converted: number; conversionRate: number }[];
    needsAttention: { id: string; fullName: string; associate: string; center: string; createdAt: string | null; followUpCount: number; stageName: string; visits: number | null }[];
    inconsistent: number;
  };
  quality: { key: string; count: number; pct: number; samples: { id: string; fullName: string }[] }[];
  insights: Insight[];
  ai: import("@/lib/ai").AIAnalysis;
  facets: Record<string, string[]>;
};

export function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)}
      </div>
      <Skeleton className="h-[320px]" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  );
}

/* --------------------------- shared group table --------------------------- */
const METRIC_COLS: { key: keyof GroupRow; label: string; fmt: (v: number | null) => string }[] = [
  { key: "leads", label: "Leads", fmt: (v) => num(v) },
  { key: "converted", label: "Converted", fmt: (v) => num(v) },
  { key: "conversionRate", label: "Conv. rate", fmt: (v) => pctStr(v) },
  { key: "trials", label: "Trials", fmt: (v) => num(v) },
  { key: "trialRate", label: "Trial rate", fmt: (v) => pctStr(v) },
  { key: "followUpCoverage", label: "FU coverage", fmt: (v) => pctStr(v) },
  { key: "purchases", label: "Purchases", fmt: (v) => num(v) },
  { key: "ltv", label: "Total LTV", fmt: (v) => inrCompact(v) },
  { key: "avgLtv", label: "Avg LTV/lead", fmt: (v) => inrCompact(v) },
  { key: "avgLtvPerConverted", label: "Avg LTV/conv", fmt: (v) => inrCompact(v) },
  { key: "visits", label: "Visits", fmt: (v) => num(v) },
  { key: "retentionRate", label: "Retention", fmt: (v) => pctStr(v) },
  { key: "avgTimeToConversion", label: "Avg TTC", fmt: (v) => days(v) },
];

export function GroupTable({
  rows,
  dimension,
  onDrill,
  limit = 40,
  minLeads = 0,
}: {
  rows: GroupRow[];
  dimension: string;
  onDrill?: (key: string) => void;
  limit?: number;
  minLeads?: number;
}) {
  const [sortKey, setSortKey] = useState<keyof GroupRow>("leads");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [min, setMin] = useState(minLeads);
  const data = useMemo(
    () => [...rows].filter((r) => r.leads >= min).sort((a, b) => {
      const av = (a[sortKey] ?? 0) as number; const bv = (b[sortKey] ?? 0) as number; return dir === "desc" ? bv - av : av - bv;
    }).slice(0, limit),
    [rows, sortKey, dir, limit, min],
  );
  const maxLeads = Math.max(1, ...data.map((d) => d.leads));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-faint text-[11px]">Minimum leads</span>
        <input type="range" min={0} max={100} value={min} onChange={(e) => setMin(Number(e.target.value))} style={{ accentColor: "var(--accent)" }} />
        <span className="num text-[11.5px]">{min}</span>
        <span className="text-faint ml-auto text-[11px]">{data.length} of {rows.length} groups</span>
      </div>
      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 z-10" style={{ background: "var(--surface-2)" }}>
            <tr className="text-faint text-[10.5px] tracking-wide uppercase">
              <th className="px-3 py-2.5 text-left">{dimension}</th>
              {METRIC_COLS.map((c) => (
                <th key={String(c.key)} className="px-3 py-2.5 text-right">
                  <button className={cx("hover:underline", sortKey === c.key && "font-bold")} style={sortKey === c.key ? { color: "var(--accent)" } : undefined}
                    onClick={() => { if (sortKey === c.key) setDir(dir === "desc" ? "asc" : "desc"); else { setSortKey(c.key); setDir("desc"); } }}>
                    {c.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.key} className={cx("border-t transition-colors hover:bg-[var(--surface-2)]", onDrill && "cursor-pointer")} onClick={() => onDrill?.(r.key)}>
                <td className="min-w-[180px] px-3 py-2.5"><div className="font-medium">{r.key}</div><StatBar value={r.leads} max={maxLeads} /></td>
                {METRIC_COLS.map((c) => <td key={String(c.key)} className="num px-3 py-2.5 text-right whitespace-nowrap">{c.fmt((r[c.key] ?? null) as number | null)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && <EmptyState title="No groups in this population" icon={<Info size={17} />} />}
      </div>
    </div>
  );
}

/* --------------------------------- Overview -------------------------------- */
export function Overview({ a, drill, goExplorer, gran, setGran }: { a: Analytics; drill: (p: Partial<FilterState>) => void; goExplorer: () => void; gran: string; setGran: (value: string) => void }) {
  const c = a.compare?.kpis;
  const k = a.kpis;
  const cmp = (f: (x: Kpis) => number) => (c ? { current: f(k), previous: f(c) } : null);
  const ai = a.ai;

  return (
    <div className="space-y-5">
      {/* Cross-sheet truth banner */}
      {a.meta.crossSheet && (
        <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
          <IconBadge tone="info"><Zap size={14} /></IconBadge>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold">Live cross-sheet truth enabled</p>
            <p className="text-muted text-[11.5px]">Core A:W from Leads sheet · Purchases/LTV from <span className="font-medium">Sales</span> ({a.meta.crossSheet.salesRows.toLocaleString()} rows) · Visits/Trial/Retention from <span className="font-medium">Check-ins</span> ({a.meta.crossSheet.checkinRows.toLocaleString()} rows) · {a.meta.crossSheet.enrichedLeads.toLocaleString()} leads enriched</p>
          </div>
          <Chip tone="positive">{a.meta.crossSheet.enrichedLeads.toLocaleString()} enriched</Chip>
        </div>
      )}

      {/* AI Pulse row */}
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="metric-card p-4" style={{ borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border))" }}>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}><Bot size={16} /></span>
            <div>
              <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--accent)" }}>AI Pulse</p>
              <p className="text-[12px] font-medium">{ai.summary.overdue + ai.summary.missed} cadence breaks · {ai.summary.discrepancyCount} discrepancies</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip tone="critical">{ai.summary.missed} missed</Chip>
            <Chip tone="warning">{ai.summary.overdue} overdue</Chip>
            <Chip tone="info">{ai.summary.dueToday} due today</Chip>
          </div>
        </div>
        <GraphicKpi label="Avg risk score" value={`${ai.summary.avgRisk.toFixed(0)}/100`} sub="higher = more leakage risk" icon={<ShieldAlert size={15} />} tone={ai.summary.avgRisk > 60 ? "critical" : ai.summary.avgRisk > 35 ? "warning" : "positive"} compare={null} spark={<span className="text-faint text-[11px]">{ai.summary.notStarted} never contacted</span>} />
        <GraphicKpi label="Avg opportunity" value={`${ai.summary.avgOpportunity.toFixed(0)}/100`} sub="reactivation readiness" icon={<Target size={15} />} tone="positive" />
        <GraphicKpi label="Cadence complete" value={`${ai.summary.complete.toLocaleString()}`} sub={`${pctStr((ai.summary.complete / (ai.summary.total || 1)) * 100)} of population`} icon={<Timer size={15} />} tone="info" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <GraphicKpi label="Total leads" value={num(k.totalLeads)} sub="distinct lead IDs" icon={<Users size={14} />} tone="accent" compare={cmp((x) => x.totalLeads)} onClick={goExplorer} trend={a.series.map((point) => point.leads)} />
        <GraphicKpi label="Converted" value={num(k.converted)} sub={`${pctStr(k.conversionRate)} of leads`} icon={<BadgeCheck size={14} />} tone="positive" compare={cmp((x) => x.converted)} onClick={() => drill({ conversionStatus: ["Converted"] })} trend={a.series.map((point) => point.converted)} />
        <GraphicKpi label="Conversion rate" value={pctStr(k.conversionRate)} sub="converted ÷ total" icon={<TrendingUp size={14} />} tone="info" compare={cmp((x) => x.conversionRate)} trend={a.series.map((point) => point.conversionRate)} onClick={() => drill({ conversionStatus: ["Converted"] })} />
        <GraphicKpi label="Trial leads" value={num(k.trials)} sub={`${pctStr(k.trialRate)} participation`} icon={<Activity size={14} />} tone="info" compare={cmp((x) => x.trials)} trend={a.series.map((point) => point.trials)} onClick={() => drill({ trialStatus: ["Trial Completed"] })} />
        <GraphicKpi label="Trial rate" value={pctStr(k.trialRate)} sub="trial ÷ total" icon={<Activity size={14} />} tone="accent" trend={a.series.map((point) => point.leads ? point.trials / point.leads * 100 : 0)} onClick={() => drill({ trialStatus: ["Trial Completed"] })} />
        <GraphicKpi label="Total purchases" value={num(k.purchases)} sub="from Sales sheet truth" icon={<Wallet size={14} />} tone="positive" compare={cmp((x) => x.purchases)} onClick={() => drill({ purchasesMin: 1 })} />
        <GraphicKpi label="Total LTV" value={inrCompact(k.totalLtv)} sub="Sales-truth value" icon={<Wallet size={14} />} tone="positive" compare={cmp((x) => x.totalLtv)} trend={a.series.map((point) => point.ltv)} onClick={() => drill({ ltvMin: 0.01 })} />
        <GraphicKpi label="Avg LTV / lead" value={inr(k.avgLtvPerLead)} sub="across all leads" icon={<Wallet size={14} />} tone="warning" compare={cmp((x) => x.avgLtvPerLead)} trend={a.series.map((point) => point.leads ? point.ltv / point.leads : 0)} onClick={goExplorer} />
        <GraphicKpi label="Avg LTV / converted" value={inr(k.avgLtvPerConverted)} sub="converted only" icon={<Wallet size={14} />} tone="warning" onClick={() => drill({ conversionStatus: ["Converted"] })} />
        <GraphicKpi label="Total visits" value={num(k.visits)} sub="from Check-ins truth" icon={<Eye size={14} />} tone="info" compare={cmp((x) => x.visits)} onClick={() => drill({ visitsMin: 1 })} />
        <GraphicKpi label="Avg time to conversion" value={days(k.avgTimeToConversion)} invert sub="creation → conversion" icon={<Timer size={14} />} tone="info" compare={k.avgTimeToConversion != null && c?.avgTimeToConversion != null ? { current: k.avgTimeToConversion, previous: c.avgTimeToConversion } : null} onClick={() => drill({ conversionStatus: ["Converted"] })} />
        <GraphicKpi label="Follow-up coverage" value={pctStr(k.followUpCoverage)} sub="≥1 recorded FU" icon={<Phone size={14} />} tone="accent" compare={cmp((x) => x.followUpCoverage)} onClick={() => drill({ followUpActivity: "withFollowUps" })} />
        <GraphicKpi label="Retained" value={num(k.retained)} sub={`${pctStr(k.retentionRate)} of converted`} icon={<Building2 size={14} />} tone="positive" compare={cmp((x) => x.retained)} onClick={() => drill({ retentionStatus: ["Retained"] })} />
        <GraphicKpi label="Avg FU / lead" value={num(k.avgFollowUps, 2)} sub="mean follow-ups" icon={<Phone size={14} />} tone="accent" onClick={goExplorer} />
        <GraphicKpi label="Avg days to 1st FU" value={days(k.avgDaysToFirstFollowUp)} invert icon={<Timer size={14} />} tone="warning" onClick={() => drill({ followUpActivity: "withFollowUps" })} />
      </div>
      <Card title="Lead acquisition & conversion trend" subtitle="Lead creation cohorts · click a period to explore its leads" actions={<Toggle size="sm" value={gran} onChange={setGran} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />}>
        <TrendChart height={300} onDrill={(date) => {
          const from = date.length === 7 ? `${date}-01` : date;
          const end = new Date(`${from}T00:00:00Z`);
          if (gran === "month") end.setUTCMonth(end.getUTCMonth() + 1, 0);
          else if (gran === "week") end.setUTCDate(end.getUTCDate() + 6);
          drill({ preset: "Custom Range", dateDimension: "createdAt", from, to: end.toISOString().slice(0, 10) });
        }} data={a.series as unknown as Record<string, string | number>[]} series={[{ key: "leads", name: "Leads", color: "var(--chart-1)", type: "area" }, { key: "converted", name: "Converted", color: "var(--chart-3)", type: "area" }, { key: "conversionRate", name: "Conv. rate %", color: "var(--chart-2)", type: "line", yAxis: "right" }]} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Lead-to-customer funnel" subtitle="Current-status view blended with cross-sheet truth">
          <FunnelBars funnel={a.funnel} />
        </Card>
        <Card title="Channel contribution" subtitle="Leads by acquisition channel — click to drill">
          <DonutChart data={a.groups.channel.slice(0, 7).map((g) => ({ key: g.key, value: g.leads }))} onClick={(key) => drill({ channel: [key] })} />
        </Card>
        <Card title="Center performance" subtitle="Leads by studio"><BarRank data={a.groups.center.slice(0, 10).map((g) => ({ key: g.key, value: g.leads }))} onClick={(key) => drill({ center: [key] })} /></Card>
        <Card title="Associate leaderboard" subtitle="Top associates by converted leads"><BarRank color="var(--chart-3)" data={[...a.groups.associate].sort((x, y) => y.converted - x.converted).slice(0, 10).map((g) => ({ key: g.key, value: g.converted }))} onClick={(key) => drill({ associate: [key] })} /></Card>
        <Card title="Stage distribution" subtitle="Where leads currently sit"><BarRank color="var(--chart-5)" data={a.groups.stageName.slice(0, 10).map((g) => ({ key: g.key, value: g.leads }))} onClick={(key) => drill({ stageName: [key] })} /></Card>
        <Card title="LTV distribution" subtitle="Leads by Sales-truth lifetime value band"><BarRank color="var(--chart-4)" data={a.ltvBands.map((b) => ({ key: b.key, value: b.leads }))} height={240} /></Card>
      </div>

      <Card title="Source-wise conversion matrix" subtitle="All metrics use Sales/Check-ins truth where available">
        <GroupTable rows={a.groups.sourceName} dimension="Source" onDrill={(key) => drill({ sourceName: [key] })} />
      </Card>

      <AIInsightsCard a={a} drill={drill} />
    </div>
  );
}

export function FunnelBars({ funnel }: { funnel: Analytics["funnel"] }) {
  const max = funnel[0]?.value || 1;
  return (
    <div className="space-y-3">
      {funnel.map((s, i) => (
        <div key={s.stage}>
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
            <span className="font-medium">{s.stage}</span>
            <span className="num text-muted">{num(s.value)} · {pctStr(s.ofTotal)} of leads{i > 0 && <span className="text-faint"> · step {pctStr(s.stepRate)}</span>}</span>
          </div>
          <div className="h-7 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(s.value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
          </div>
          {i > 0 && s.dropOff > 0 && <p className="text-faint mt-1 text-[11px]">Drop-off from previous stage: <span className="num">{num(s.dropOff)}</span> leads</p>}
        </div>
      ))}
    </div>
  );
}

/* --------------------------- AI cards --------------------------- */
export function AIInsightsCard({ a, drill }: { a: Analytics; drill: (p: Partial<FilterState>) => void }) {
  const ai = a.ai;
  return (
    <div className="space-y-4">
      <Card title="AI cadence breakdown" subtitle="Expected vs actual follow-up progression">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ai.cadenceBreakdown.map((c) => (
            <div key={c.label} className="rounded-xl border p-3">
              <p className="text-[12px] font-semibold">{c.label}</p>
              <div className="mt-2 space-y-1.5 text-[11.5px]">
                <div className="flex justify-between"><span className="text-muted">Done</span><span className="num font-medium" style={{ color: "var(--positive)" }}>{num(c.done)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Overdue</span><span className="num font-medium" style={{ color: "var(--critical)" }}>{num(c.overdue)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Due today</span><span className="num font-medium" style={{ color: "var(--warning)" }}>{num(c.due)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Upcoming</span><span className="num">{num(c.upcoming)}</span></div>
              </div>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                <span style={{ width: `${(c.done / (a.meta.filteredRows || 1)) * 100}%`, background: "var(--positive)" }} />
                <span style={{ width: `${(c.overdue / (a.meta.filteredRows || 1)) * 100}%`, background: "var(--critical)" }} />
                <span style={{ width: `${(c.due / (a.meta.filteredRows || 1)) * 100}%`, background: "var(--warning)" }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="AI recommendations" subtitle="Prioritised actions from live anomaly detection">
        <div className="grid gap-3 md:grid-cols-2">
          {ai.recommendations.map((r, i) => (
            <div key={i} className="rounded-xl border p-4" style={{ background: r.priority === "high" ? "var(--critical-soft)" : r.priority === "medium" ? "var(--warning-soft)" : "var(--surface-2)" }}>
              <div className="flex items-center gap-2">
                <Chip tone={r.priority === "high" ? "critical" : r.priority === "medium" ? "warning" : "neutral"}>{r.priority}</Chip>
                <span className="text-[11.5px] text-muted">{r.leads ? `${r.leads.toLocaleString()} leads` : "no direct cohort"}</span>
              </div>
              <h4 className="mt-2 text-[13px] font-semibold">{r.title}</h4>
              <p className="text-muted mt-1 text-[12px] leading-relaxed">{r.description}</p>
              <p className="mt-2 text-[11.5px] font-medium" style={{ color: "var(--accent)" }}>→ {r.action}</p>
            </div>
          ))}
        </div>
      </Card>

      <InsightsPanel insights={a.insights} drill={drill} />
    </div>
  );
}

export function InsightsPanel({ insights, drill }: { insights: Insight[]; drill: (p: Partial<FilterState>) => void }) {
  const icon = (s: Insight["severity"]) => s === "positive" ? <BadgeCheck size={14} /> : s === "critical" ? <ShieldAlert size={14} /> : s === "warning" ? <AlertTriangle size={14} /> : <Lightbulb size={14} />;
  const color = (s: Insight["severity"]) => s === "positive" ? "var(--positive)" : s === "critical" ? "var(--critical)" : s === "warning" ? "var(--warning)" : "var(--info)";
  if (!insights.length) return <Card title="Intelligence"><EmptyState title="Not enough data in this population" description="Widen the date range or loosen filters so findings can be computed with reasonable confidence." icon={<Lightbulb size={18} />} /></Card>;
  return (
    <Card title="Intelligent insights & opportunities" subtitle="Computed from the filtered population — no hardcoded statements">
      <div className="grid gap-3 lg:grid-cols-2">
        {insights.map((i) => (
          <article key={i.id} className="rounded-xl border p-4" style={{ background: "var(--surface-2)" }}>
            <div className="mb-2 flex items-start gap-2">
              <span style={{ color: color(i.severity) }}>{icon(i.severity)}</span>
              <h4 className="text-[13px] leading-snug font-semibold">{i.title}</h4>
              {i.exploratory && <Chip tone="info">exploratory</Chip>}
            </div>
            <dl className="space-y-1.5 text-[12px]">
              {[["Evidence", i.evidence], ["Why it matters", i.why], ["Likely factors", i.factors], ["Recommended action", i.action], ["Monitor", i.monitor]].map(([l, v]) => (
                <div key={l}><dt className="text-faint text-[10.5px] tracking-wide uppercase">{l}</dt><dd className="text-muted leading-relaxed">{v}</dd></div>
              ))}
            </dl>
            {i.filter && <Button size="sm" variant="subtle" className="mt-3" onClick={() => { const f: Partial<FilterState> = {}; for (const [k, v] of Object.entries(i.filter!)) { if (k === "followUpActivity") f.followUpActivity = v; else (f as Record<string, string[]>)[k] = [v]; } drill(f); }}>Investigate <ArrowRight size={12} /></Button>}
          </article>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------ Generic module ----------------------------- */
export function DimensionModule({
  a,
  title,
  dimensionKey,
  label,
  drill,
  extra,
}: {
  a: Analytics;
  title: string;
  dimensionKey: string;
  label: string;
  drill: (p: Partial<FilterState>) => void;
  extra?: React.ReactNode;
}) {
  const rows = a.groups[dimensionKey] ?? [];
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const scatter = rows.filter((r) => r.leads >= 5).map((r) => ({ x: r.leads, y: r.conversionRate, z: r.ltv, name: r.key }));
  const selected = rows.filter((r) => compareKeys.includes(r.key));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GraphicKpi label={`${label}s in view`} value={num(rows.length)} icon={<Users size={14} />} tone="accent" />
        <GraphicKpi label="Best conversion rate" value={rows.length ? pctStr([...rows].filter((r) => r.leads >= 20).sort((x, y) => y.conversionRate - x.conversionRate)[0]?.conversionRate ?? 0) : "—"} sub={[...rows].filter((r) => r.leads >= 20).sort((x, y) => y.conversionRate - x.conversionRate)[0]?.key} icon={<TrendingUp size={14} />} tone="positive" />
        <GraphicKpi label="Highest volume" value={num(rows[0]?.leads ?? 0)} sub={rows[0]?.key} icon={<Users size={14} />} tone="info" />
        <GraphicKpi label="Highest total LTV" value={inrCompact([...rows].sort((x, y) => y.ltv - x.ltv)[0]?.ltv ?? 0)} sub={[...rows].sort((x, y) => y.ltv - x.ltv)[0]?.key} icon={<Wallet size={14} />} tone="positive" />
      </div>
      {extra}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`${title} — lead volume`}><BarRank data={rows.slice(0, 12).map((r) => ({ key: r.key, value: r.leads }))} onClick={(key) => drill({ [dimensionKey]: [key] } as Partial<FilterState>)} /></Card>
        <Card title="Volume vs conversion rate" subtitle="Bubble size = total LTV. Groups with ≥5 leads only."><ScatterPlot data={scatter} xName="Leads" yName="Conversion rate" onClick={(key) => drill({ [dimensionKey]: [key] } as Partial<FilterState>)} /></Card>
      </div>
      <Card title="Compare mode" subtitle="Select two or more groups for a side-by-side scorecard" actions={<MultiSelect label="Select groups" options={rows.map((r) => r.key)} value={compareKeys} onChange={setCompareKeys} />}>
        {selected.length < 2 ? <EmptyState title="Pick at least two groups" description="Use the selector above to compare performance side by side." icon={<TrendingUp size={17} />} /> : (
          <div className="overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-faint text-[10.5px] uppercase"><th className="px-3 py-2 text-left">Metric</th>{selected.map((s) => <th key={s.key} className="px-3 py-2 text-right">{s.key}</th>)}</tr></thead>
              <tbody>{METRIC_COLS.map((c) => { const best = Math.max(...selected.map((s) => (s[c.key] ?? 0) as number)); return <tr key={String(c.key)} className="border-t"><td className="px-3 py-2">{c.label}</td>{selected.map((s) => { const v = (s[c.key] ?? 0) as number; return <td key={s.key} className="num px-3 py-2 text-right" style={v === best && best > 0 ? { color: "var(--positive)", fontWeight: 600 } : undefined}>{c.fmt(v)}</td>; })}</tr>; })}</tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title={`${title} — full matrix`} subtitle="Click any row to drill through to the underlying leads"><GroupTable rows={rows} dimension={label} onDrill={(key) => drill({ [dimensionKey]: [key] } as Partial<FilterState>)} limit={200} /></Card>
    </div>
  );
}

/* --------------------------------- Funnel ---------------------------------- */
export function FunnelModule({ a, drill }: { a: Analytics; drill: (p: Partial<FilterState>) => void }) {
  const [dim, setDim] = useState("center");
  return (
    <div className="space-y-4">
      <Card title="Conversion funnel" subtitle="Stages derived from current record status merged with Sales-truth conversion">
        <FunnelBars funnel={a.funnel} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Stage distribution" subtitle="Current stage of every lead in the population"><BarRank data={a.groups.stageName.slice(0, 14).map((g) => ({ key: g.key, value: g.leads }))} height={360} onClick={(key) => drill({ stageName: [key] })} /></Card>
        <Card title="Time to conversion" subtitle="Converted leads only (Sales-truth date)"><BarRank color="var(--chart-2)" data={a.timeToConv.map((t) => ({ key: t.key, value: t.leads }))} height={360} /></Card>
      </div>
      <Card title="Funnel leakage by dimension" subtitle="Compare progression across the business" actions={<Select className="w-[180px]" value={dim} onChange={setDim} options={[{ value: "center", label: "Center" }, { value: "associate", label: "Associate" }, { value: "sourceName", label: "Source" }, { value: "channel", label: "Channel" }, { value: "utmCampaign", label: "Campaign" }]} />}>
        <GroupTable rows={a.groups[dim] ?? []} dimension={dim} onDrill={(key) => drill({ [dim]: [key] } as Partial<FilterState>)} limit={100} />
      </Card>
    </div>
  );
}

/* ------------------------------- Follow-ups -------------------------------- */
export function FollowUpModule({ a, drill }: { a: Analytics; drill: (p: Partial<FilterState>) => void }) {
  const k = a.kpis;
  const ai = a.ai;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GraphicKpi label="Follow-up coverage" value={pctStr(k.followUpCoverage)} sub="leads with ≥1 recorded FU" icon={<Phone size={14} />} tone="accent" onClick={() => drill({ followUpActivity: "withFollowUps" })} />
        <GraphicKpi label="Avg FU / lead" value={num(k.avgFollowUps, 2)} icon={<Phone size={14} />} tone="info" />
        <GraphicKpi label="Avg days to 1st FU" value={days(k.avgDaysToFirstFollowUp)} invert icon={<Timer size={14} />} tone="warning" />
        <GraphicKpi label="Cadence breaks" value={num(ai.summary.overdue + ai.summary.missed)} sub={`${num(ai.summary.missed)} missed`} icon={<AlertTriangle size={14} />} tone="critical" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Conversion by recorded follow-up count" subtitle="Association only — a recorded date does not confirm contact">
          <div className="space-y-2.5">
            {a.followUp.buckets.map((b) => (
              <div key={b.key}><div className="flex justify-between text-[12.5px]"><span>{b.key}</span><span className="num text-muted">{num(b.leads)} leads · {pctStr(b.conversionRate)} conv.</span></div><StatBar value={b.conversionRate} max={Math.max(1, ...a.followUp.buckets.map((x) => x.conversionRate))} /></div>
            ))}
          </div>
        </Card>
        <Card title="Conversion by speed of first follow-up">
          <div className="space-y-2.5">
            {a.followUp.speed.map((b) => (
              <div key={b.key}><div className="flex justify-between text-[12.5px]"><span>{b.key}</span><span className="num text-muted">{num(b.leads)} leads · {pctStr(b.conversionRate)} conv.</span></div><StatBar value={b.conversionRate} max={Math.max(1, ...a.followUp.speed.map((x) => x.conversionRate))} tone="var(--chart-2)" /></div>
            ))}
          </div>
        </Card>
      </div>
      <Card title="AI cadence breakdown"><div className="grid gap-3 sm:grid-cols-4">{ai.cadenceBreakdown.map((c) => <div key={c.label} className="rounded-xl border p-3"><p className="text-[12px] font-semibold">{c.label}</p><p className="text-muted num mt-1 text-[11.5px]">{num(c.done)} done · {num(c.overdue)} overdue</p></div>)}</div></Card>
      <Card title="Follow-up performance by associate"><GroupTable rows={a.groups.associate} dimension="Associate" onDrill={(key) => drill({ associate: [key] })} limit={100} /></Card>
      <Card title="Leads potentially requiring attention" subtitle="Unconverted leads with fewer than two recorded follow-ups, highest engagement first">
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-[12.5px]">
            <thead style={{ background: "var(--surface-2)" }}><tr className="text-faint text-[10.5px] uppercase">{["Lead", "Created", "Associate", "Center", "Stage", "Follow-ups", "Visits"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody>{a.followUp.needsAttention.map((l) => <tr key={l.id} className="border-t hover:bg-[var(--surface-2)]"><td className="px-3 py-2 font-medium">{l.fullName || l.id}</td><td className="num px-3 py-2">{l.createdAt ?? "—"}</td><td className="px-3 py-2">{l.associate}</td><td className="px-3 py-2">{l.center}</td><td className="px-3 py-2">{l.stageName}</td><td className="num px-3 py-2">{l.followUpCount}</td><td className="num px-3 py-2">{num(l.visits)}</td></tr>)}</tbody>
          </table>
          {!a.followUp.needsAttention.length && <EmptyState title="No at-risk leads in this population" icon={<BadgeCheck size={17} />} />}
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- Revenue & lifecycle -------------------------- */
export function RevenueModule({ a, drill }: { a: Analytics; drill: (p: Partial<FilterState>) => void }) {
  const k = a.kpis;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GraphicKpi label="Total LTV (Sales truth)" value={inrCompact(k.totalLtv)} sub={`${num(k.purchases)} purchases`} icon={<Wallet size={14} />} tone="positive" />
        <GraphicKpi label="Avg LTV / converted" value={inr(k.avgLtvPerConverted)} icon={<Wallet size={14} />} tone="positive" />
        <GraphicKpi label="Total purchases" value={num(k.purchases)} icon={<Wallet size={14} />} tone="accent" />
        <GraphicKpi label="Visits / converted" value={num(k.converted ? k.visits / k.converted : 0, 1)} sub="Check-ins truth" icon={<Eye size={14} />} tone="info" />
      </div>
      <Card title="Revenue trend" subtitle="Sales-truth LTV attributed to leads created in each period"><TrendChart data={a.series as unknown as Record<string, string | number>[]} series={[{ key: "ltv", name: "LTV", color: "var(--chart-3)", type: "area" }]} fmt={(_, v) => inrCompact(v)} /></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="LTV distribution"><BarRank color="var(--chart-4)" data={a.ltvBands.map((b) => ({ key: b.key, value: b.leads }))} /></Card>
        <Card title="Time to conversion"><BarRank color="var(--chart-2)" data={a.timeToConv.map((b) => ({ key: b.key, value: b.leads }))} /></Card>
        <Card title="Commercial value by center"><BarRank money color="var(--chart-5)" data={a.groups.center.slice(0, 10).map((g) => ({ key: g.key, value: g.ltv }))} onClick={(key) => drill({ center: [key] })} /></Card>
        <Card title="Commercial value by source"><BarRank money color="var(--chart-6)" data={a.groups.sourceName.slice(0, 10).map((g) => ({ key: g.key, value: g.ltv }))} onClick={(key) => drill({ sourceName: [key] })} /></Card>
      </div>
      <Card title="Conversion status breakdown"><GroupTable rows={a.groups.conversionStatus} dimension="Conversion status" onDrill={(key) => drill({ conversionStatus: [key] })} /></Card>
    </div>
  );
}

export function LifecycleModule({ a, drill }: { a: Analytics; drill: (p: Partial<FilterState>) => void }) {
  const k = a.kpis;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GraphicKpi label="Trial participation" value={pctStr(k.trialRate)} sub={`${num(k.trials)} leads`} icon={<Activity size={14} />} tone="info" />
        <GraphicKpi label="Trial → conversion" value={pctStr(k.trials ? (k.converted / k.trials) * 100 : 0)} sub="converted ÷ trial" icon={<TrendingUp size={14} />} tone="positive" />
        <GraphicKpi label="Retained" value={num(k.retained)} sub={`${pctStr(k.retentionRate)} of converted`} icon={<Building2 size={14} />} tone="positive" />
        <GraphicKpi label="Avg time to conversion" value={days(k.avgTimeToConversion)} invert icon={<Timer size={14} />} tone="info" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Trial status"><DonutChart data={a.groups.trialStatus.map((g) => ({ key: g.key, value: g.leads }))} onClick={(key) => drill({ trialStatus: [key] })} /></Card>
        <Card title="Conversion status"><DonutChart data={a.groups.conversionStatus.map((g) => ({ key: g.key, value: g.leads }))} onClick={(key) => drill({ conversionStatus: [key] })} /></Card>
        <Card title="Retention status"><DonutChart data={a.groups.retentionStatus.map((g) => ({ key: g.key, value: g.leads }))} onClick={(key) => drill({ retentionStatus: [key] })} /></Card>
      </div>
      <Card title="Trial status outcomes"><GroupTable rows={a.groups.trialStatus} dimension="Trial status" onDrill={(key) => drill({ trialStatus: [key] })} /></Card>
      <Card title="Retention outcomes by source"><GroupTable rows={a.groups.sourceName} dimension="Source" onDrill={(key) => drill({ sourceName: [key] })} limit={100} /></Card>
      <Card title="Class type lifecycle"><GroupTable rows={a.groups.classType} dimension="Class type" onDrill={(key) => drill({ classType: [key] })} /></Card>
    </div>
  );
}

/* ------------------------------- Data quality ------------------------------ */
export function QualityModule({ a }: { a: Analytics }) {
  const flagged = a.quality.reduce((n, q) => Math.max(n, q.count), 0);
  const disc = a.ai.summary.discrepancyCount;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GraphicKpi label="Records in view" value={num(a.meta.filteredRows)} icon={<Eye size={14} />} tone="info" />
        <GraphicKpi label="Checks run" value={num(a.quality.length)} icon={<ShieldAlert size={14} />} tone="accent" />
        <GraphicKpi label="Largest single issue" value={num(flagged)} icon={<AlertTriangle size={14} />} tone="warning" />
        <GraphicKpi label="Cross-sheet discrepancies" value={num(disc)} icon={<Bot size={14} />} tone={disc ? "critical" : "positive"} sub="Sales/Check-ins vs Leads sheet" />
      </div>
      {disc > 0 && (
        <Card title="Cross-sheet discrepancies" subtitle="Leads where Sales/Check-ins truth disagrees with the Leads sheet">
          <div className="max-h-[360px] overflow-auto rounded-xl border">
            <table className="w-full text-[12.5px]">
              <thead style={{ background: "var(--surface-2)" }}><tr className="text-faint text-[10.5px] uppercase"><th className="px-3 py-2 text-left">Lead</th><th className="px-3 py-2 text-left">Member ID</th><th className="px-3 py-2 text-left">Anomaly</th><th className="px-3 py-2 text-right">Sheet LTV</th><th className="px-3 py-2 text-right">Sales LTV</th><th className="px-3 py-2 text-right">Sales Purchases</th></tr></thead>
              <tbody>
                {a.ai.discrepancies.slice(0, 100).map((d) => {
                  const lead = a.ai as unknown as { meta?: unknown }; // placeholder; actual lead lookup via groups? We'll just display d
                  return (
                    <tr key={d.id} className="border-t hover:bg-[var(--surface-2)]">
                      <td className="px-3 py-2 font-medium">{d.fullName || d.id}</td>
                      <td className="num px-3 py-2">{d.id}</td>
                      <td className="px-3 py-2 text-[11.5px]">{d.discrepancy}</td>
                      <td className="num px-3 py-2 text-right">—</td>
                      <td className="num px-3 py-2 text-right">—</td>
                      <td className="num px-3 py-2 text-right">—</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Card title="Data health monitor" subtitle="Every check is evaluated against the filtered population">
        <div className="grid gap-3 md:grid-cols-2">
          {a.quality.map((q) => (
            <div key={q.key} className="rounded-xl border p-3.5">
              <div className="flex items-baseline justify-between"><p className="text-[12.5px] font-semibold">{q.key}</p><span className="num text-[12.5px]" style={{ color: q.count ? "var(--warning)" : "var(--positive)" }}>{num(q.count)} · {pctStr(q.pct)}</span></div>
              <div className="my-2"><StatBar value={q.pct} max={100} tone={q.count ? "var(--warning)" : "var(--positive)"} /></div>
              <div className="flex flex-wrap gap-1">{q.samples.map((s) => <Chip key={s.id}>{s.fullName || s.id}</Chip>)}{!q.samples.length && <span className="text-faint text-[11.5px]">No affected records</span>}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Metric definitions & business rules" subtitle="Applied consistently across every module">
        <div className="grid gap-2 md:grid-cols-2">
          {[
            ["Total Leads", "Count of distinct, valid lead IDs within the active filtered population."],
            ["Conversion Rate (Sales-truth)", "A lead is converted when Sales sheet shows at least one succeeded purchase for that Member ID/email."],
            ["Total LTV (Sales-truth)", "Sum of Payment Value for succeeded, non-voided sales joined on Member ID or Email."],
            ["Visits (Check-ins truth)", "Count of Checked In = TRUE rows for that Member ID joined from the Check-ins sheet."],
            ["Trial Status (Check-ins truth)", "Trial Completed if any check-in for that member is a trial class; otherwise Not Tried."],
            ["Retention (Check-ins + Sales)", "Retained when visits ≥5 or (visits ≥3 and purchases ≥2) — configurable heuristic."],
            ["Avg Time to Conversion", "Mean days between Created At and earliest Sale Date from Sales sheet."],
            ["Follow-up Coverage", "Share with ≥1 recorded follow-up date/comment; a record is not proof of contact."],
            ["Cross-sheet flags", "Discrepancies between Leads sheet values and Sales/Check-ins truth are surfaced as flags."],
            ["Cadence", "Follow-up due dates follow the cadence configured in Settings (defaults: FU1 2d after creation, then 3d / 5d / 7d gaps); overdue/missed computed daily IST."],
          ].map(([t, d]) => <div key={t} className="rounded-xl border p-3"><p className="text-[12.5px] font-semibold">{t}</p><p className="text-muted mt-0.5 text-[12px] leading-relaxed">{d}</p></div>)}
        </div>
      </Card>
    </div>
  );
}
