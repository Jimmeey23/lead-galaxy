"use client";

import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowDownUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns3,
  Database,
  Download,
  GripVertical,
  Layers,
  Pencil,
  Pin,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { Button, Card, Chip, Drawer, EmptyState, Input, Popover, Select, Skeleton } from "./ui";
import { LeadDrawer } from "./lead-drawer";
import { useApp, useCadenceConfig, usePost } from "@/lib/store";
import { cx, fmtDate, inr, inrCompact, num, pctStr } from "@/lib/format";
import type { Lead } from "@/lib/types";

// local cadence helper (mirrors lib/ai but client-side for instant badges)
// cumulative days default to the configured cadence fetched via useCadenceConfig
let CADENCE_CUMULATIVE = [2, 5, 10, 17];
export function setClientCadence(cumulative: number[]) {
  if (cumulative?.length === 4) CADENCE_CUMULATIVE = cumulative;
}
function cadenceBadge(l: Lead) {
  if (!l.createdAt) return { label: "no date", tone: "neutral" as const };
  const fu = l.followUps;
  const today = new Date().toISOString().slice(0, 10);
  // simple: compute first missing FU expected
  const expected = CADENCE_CUMULATIVE; // cumulative days from creation
  for (let i = 0; i < 4; i++) {
    if (fu[i]?.date) continue;
    const exp = addDays(l.createdAt, expected[i]);
    if (!exp) continue;
    if (exp < today) return { label: `FU${i + 1} overdue`, tone: "critical" as const, due: exp };
    if (exp === today) return { label: `FU${i + 1} due`, tone: "warning" as const, due: exp };
    return { label: `FU${i + 1} in ${Math.max(0, diffDays(today, exp))}d`, tone: "neutral" as const, due: exp };
  }
  return { label: "complete", tone: "positive" as const };
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function diffDays(a: string, b: string) { return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000); }

type Col = {
  key: string;
  label: string;
  group: string;
  width: number;
  align?: "right";
  render?: (l: Lead) => React.ReactNode;
  numeric?: boolean;
};

const COLS: Col[] = [
  { key: "cadence", label: "Cadence", group: "Follow-up", width: 132, render: (l) => { const c = cadenceBadge(l); return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: c.tone === "critical" ? "var(--critical-soft)" : c.tone === "warning" ? "var(--warning-soft)" : c.tone === "positive" ? "var(--positive-soft)" : "var(--surface-2)", color: c.tone === "critical" ? "var(--critical)" : c.tone === "warning" ? "var(--warning)" : c.tone === "positive" ? "var(--positive)" : "var(--text-muted)" }}>{c.tone === "critical" ? <AlertTriangle size={10} /> : c.tone === "positive" ? <CheckCircle2 size={10} /> : <Clock size={10} />} {c.label}</span>; } },
  { key: "inlineFU", label: "FU 1-4", group: "Follow-up", width: 150, render: (l) => <InlineFU lead={l} /> },
  { key: "id", label: "ID", group: "Lead Information", width: 96 },
  { key: "fullName", label: "Full Name", group: "Lead Information", width: 170 },
  { key: "phone", label: "Phone", group: "Lead Information", width: 136 },
  { key: "email", label: "Email", group: "Lead Information", width: 210 },
  { key: "memberId", label: "Member ID", group: "Lead Information", width: 110 },
  { key: "createdAt", label: "Created At", group: "Lead Information", width: 116, render: (l) => fmtDate(l.createdAt) },
  { key: "sourceName", label: "Source Name", group: "Source & Attribution", width: 165 },
  { key: "sourceId", label: "Source ID", group: "Source & Attribution", width: 92 },
  { key: "channel", label: "Channel", group: "Source & Attribution", width: 185 },
  { key: "utmSource", label: "UTM Source", group: "Source & Attribution", width: 120 },
  { key: "utmMedium", label: "UTM Medium", group: "Source & Attribution", width: 120 },
  { key: "utmCampaign", label: "UTM Campaign", group: "Source & Attribution", width: 165 },
  { key: "utmTerm", label: "UTM Term", group: "Source & Attribution", width: 110 },
  { key: "utmContent", label: "UTM Content", group: "Source & Attribution", width: 120 },
  { key: "period", label: "Period", group: "Source & Attribution", width: 100 },
  { key: "associate", label: "Associate", group: "Ownership", width: 150 },
  { key: "center", label: "Center", group: "Ownership", width: 185 },
  { key: "hostId", label: "Host ID", group: "Ownership", width: 90 },
  { key: "classType", label: "Class Type", group: "Ownership", width: 120 },
  { key: "stageName", label: "Stage Name", group: "Funnel Status", width: 190 },
  { key: "status", label: "Status", group: "Funnel Status", width: 100, render: (l) => <StatusPill v={l.status} /> },
  { key: "conversionStatus", label: "Conversion", group: "Funnel Status", width: 128, render: (l) => <StatusPill v={l.conversionStatus} /> },
  { key: "convertedAt", label: "Converted At", group: "Funnel Status", width: 120, render: (l) => fmtDate(l.convertedAt) },
  { key: "daysToConversion", label: "Days to Conv.", group: "Funnel Status", width: 110, numeric: true, align: "right", render: (l) => num(l.daysToConversion) },
  { key: "followUpCount", label: "FU Count", group: "Follow-up History", width: 90, numeric: true, align: "right" },
  { key: "firstFollowUp", label: "First Follow-up", group: "Follow-up History", width: 126, render: (l) => fmtDate(l.firstFollowUp) },
  { key: "daysToFirstFollowUp", label: "Days to 1st FU", group: "Follow-up History", width: 112, numeric: true, align: "right", render: (l) => num(l.daysToFirstFollowUp) },
  { key: "remarks", label: "Remarks", group: "Follow-up History", width: 260 },
  { key: "purchases", label: "Purchases", group: "Commercial Performance", width: 100, numeric: true, align: "right", render: (l) => <span style={{ color: (l.purchases ?? 0) > 0 ? "var(--positive)" : undefined }}>{num(l.purchases)}</span> },
  { key: "ltv", label: "LTV (Sales)", group: "Commercial Performance", width: 120, numeric: true, align: "right", render: (l) => <span className="inline-flex items-center gap-1" style={{ color: (l.ltv ?? 0) > 0 ? "var(--positive)" : undefined }}>{l.enriched ? <Bot size={10} style={{ color: "var(--info)" }} /> : null}{inr(l.ltv)}</span> },
  { key: "visits", label: "Visits (Check-ins)", group: "Commercial Performance", width: 110, numeric: true, align: "right", render: (l) => <span className="inline-flex items-center gap-1">{l.enriched ? <Bot size={10} style={{ color: "var(--info)" }} /> : null}{num(l.visits)}</span> },
  { key: "trialStatus", label: "Trial Status", group: "Client Lifecycle", width: 130, render: (l) => <StatusPill v={l.trialStatus} /> },
  { key: "retentionStatus", label: "Retention", group: "Client Lifecycle", width: 120, render: (l) => <StatusPill v={l.retentionStatus} /> },
  { key: "issues", label: "Flags", group: "Client Lifecycle", width: 120, render: (l) => l.issues.length ? <Chip tone={l.crossSheetFlags?.length ? "critical" : "warning"}>{l.issues.length}{l.crossSheetFlags?.length ? " • CS" : ""}</Chip> : <span className="text-faint">—</span> },
];

const GROUPS = [...new Set(COLS.map((c) => c.group))];
const DEFAULT_VISIBLE = COLS.filter((c) => !["sourceId", "hostId", "utmTerm", "utmContent", "period", "memberId", "daysToFirstFollowUp", "firstFollowUp"].includes(c.key)).map((c) => c.key);

function StatusPill({ v }: { v: string }) {
  const s = v.toLowerCase();
  const tone = /won|converted|retained|completed/.test(s) && !/not/.test(s) ? { bg: "var(--positive-soft)", c: "var(--positive)" } : /lost|not interested/.test(s) ? { bg: "var(--critical-soft)", c: "var(--critical)" } : /open|trial/.test(s) ? { bg: "var(--info-soft)", c: "var(--info)" } : { bg: "var(--surface-2)", c: "var(--text-muted)" };
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: tone.bg, color: tone.c }}>{v}</span>;
}

type Sort = { field: string; dir: "asc" | "desc" };
type GroupNode = {
  path: string; label: string; field: string; depth: number;
  summary: { leads: number; converted: number; conversionRate: number; purchases: number; ltv: number; avgLtv: number; visits: number; trials: number };
  children?: GroupNode[]; leads?: Lead[];
};
type Resp =
  | { mode: "flat"; total: number; page: number; pageSize: number; rows: Lead[]; summary: GroupNode["summary"] }
  | { mode: "grouped"; total: number; groups: GroupNode[]; summary: GroupNode["summary"] };

const GROUPABLE = ["center", "associate", "sourceName", "channel", "stageName", "status", "conversionStatus", "trialStatus", "retentionStatus", "classType", "utmCampaign", "utmSource", "utmMedium"];

function InlineFU({ lead }: { lead: Lead }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftComment, setDraftComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{index:number;left:number;top:number} | null>(null);
  const { bumpRefresh } = useApp();
  const startEdit = (index: number) => {
    setOpenIdx(index); setHover(null); setError(null);
    setDraftDate(lead.followUps[index]?.date ?? "");
    setDraftComment(lead.followUps[index]?.comment ?? "");
  };
  const preview = (index: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setHover({index,left:Math.max(8,Math.min(rect.left,window.innerWidth-350)),top:Math.max(8,Math.min(rect.bottom+8,window.innerHeight-210))});
  };
  const save = async () => {
    if (openIdx === null) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(new URL("/api/followups", window.location.origin).href, {
        method:"PUT", headers:{"content-type":"application/json"},
        body:JSON.stringify({id:lead.id,index:openIdx,date:draftDate,comment:draftComment}),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.momence?.ok) throw new Error(result.error || result.momence?.message || "Follow-up was not saved. Please retry.");
      bumpRefresh(); setOpenIdx(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Follow-up could not be saved."); }
    finally { setSaving(false); }
  };
  return <span className="inline-flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
    {[0,1,2,3].map((index) => {
      const fu=lead.followUps[index];
      return <button key={index} type="button" className="fu-button focus-ring transition-colors hover:border-[var(--accent)]" data-recorded={!!(fu?.date || fu?.comment)}
        aria-label={`Follow-up ${index+1} for ${lead.fullName || lead.id}: ${fu?.date || "No date"}. ${fu?.comment || "No comments"}. Click to add or edit.`}
        title={`FU${index+1} · ${fu?.date || "No date"}\n${fu?.comment || "No comments yet — click to add"}`}
        onMouseEnter={(event) => preview(index,event.currentTarget)} onMouseLeave={() => setHover(null)}
        onFocus={(event) => preview(index,event.currentTarget)} onBlur={() => setHover(null)} onClick={() => startEdit(index)}>{index+1}</button>;
    })}
    {hover && openIdx === null && createPortal(<div role="tooltip" className="pointer-events-none fixed z-[110] w-[330px] max-w-[calc(100vw-16px)] rounded-xl border p-3 text-xs" style={{left:hover.left,top:hover.top,background:"var(--bg-elevated)",boxShadow:"var(--shadow-lg)"}}>
      <p className="font-semibold">Follow-up {hover.index+1} · {lead.followUps[hover.index]?.date ? fmtDate(lead.followUps[hover.index].date) : "No date recorded"}</p>
      <p className="text-muted mt-2 max-h-36 overflow-hidden whitespace-pre-wrap">{lead.followUps[hover.index]?.comment || "No comments yet. Click to add."}</p><p className="mt-2 text-[var(--accent)]">Click to add or edit →</p>
    </div>,document.body)}
    {openIdx !== null && createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {if(event.key === "Escape" && !saving) setOpenIdx(null);}}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => !saving && setOpenIdx(null)} />
      <form role="dialog" aria-modal="true" aria-labelledby={`fu-title-${lead.id}`} onSubmit={(event) => {event.preventDefault();void save();}} className="relative w-full max-w-md rounded-2xl border p-5" style={{background:"var(--bg-elevated)",boxShadow:"var(--shadow-lg)"}}>
        <h2 id={`fu-title-${lead.id}`} className="text-base font-semibold">Follow-up {openIdx+1}</h2><p className="text-muted mb-4 text-xs">{lead.fullName || lead.id} · changes sync to Momence</p>
        <label className="mb-1 block text-xs font-medium" htmlFor={`fu-date-${lead.id}`}>Follow-up date</label>
        <Input id={`fu-date-${lead.id}`} type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} />
        <label className="mb-1 mt-4 block text-xs font-medium" htmlFor={`fu-comment-${lead.id}`}>Comments and member response</label>
        <textarea autoFocus id={`fu-comment-${lead.id}`} value={draftComment} onChange={(event) => setDraftComment(event.target.value)} rows={5} className="focus-ring w-full resize-y rounded-xl border p-3 text-sm" style={{background:"var(--surface)"}} placeholder="Record the conversation, outcome and next agreed action…" />
        {error && <p role="alert" className="mt-3 text-xs" style={{color:"var(--critical)"}}>{error}</p>}
        <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" disabled={saving} onClick={() => setOpenIdx(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save follow-up"}</Button></div>
      </form>
    </div>,document.body)}
  </span>;
}

export function LeadExplorer() {
  const { filters, refreshKey, bumpRefresh } = useApp();
  const { cumulative } = useCadenceConfig();
  setClientCadence(cumulative);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<Sort[]>([{ field: "createdAt", dir: "desc" }]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [visible, setVisible] = useState<string[]>(DEFAULT_VISIBLE);
  const [order, setOrder] = useState<string[]>(COLS.map((c) => c.key));
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [pinned, setPinned] = useState<string[]>(["fullName"]);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [aiFilter, setAiFilter] = useState<"all" | "overdue" | "missed" | "opportunities">("all");
  const dragKey = useRef<string | null>(null);

  const body = useMemo(() => ({ filters, page, pageSize, sort, groupBy, columnFilters: colFilters, aiFilter }), [filters, page, pageSize, sort, groupBy, colFilters, aiFilter]);
  const { data, loading, error } = usePost<Resp>("/api/leads", body, [refreshKey]);

  const cols = order.map((k) => COLS.find((c) => c.key === k)!).filter((c) => c && visible.includes(c.key));
  const ordered = [...cols.filter((c) => pinned.includes(c.key)), ...cols.filter((c) => !pinned.includes(c.key))];
  const w = (c: Col) => widths[c.key] ?? c.width;

  const toggleSort = (key: string, additive: boolean) => {
    if (key === "cadence" || key === "inlineFU") return;
    setPage(1);
    setSort((s) => {
      const ex = s.find((x) => x.field === key);
      const next: Sort = { field: key, dir: ex?.dir === "desc" ? "asc" : "desc" };
      return additive ? [...s.filter((x) => x.field !== key), next] : [next];
    });
  };

  const exportData = async (format: "csv" | "xls") => {
    const res = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filters, format }) });
    const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `physique57-leads.${format}`; a.click(); URL.revokeObjectURL(url);
  };

  const rows = data && data.mode === "flat" ? data.rows : [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  let pinOffset = 0;
  const offsets: Record<string, number> = {};
  for (const c of ordered) if (pinned.includes(c.key)) { offsets[c.key] = pinOffset + 76; pinOffset += w(c); }

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 p-2.5">
        <Popover width={300} trigger={() => <Button variant="outline" size="sm"><Layers size={13} /> Group by{groupBy.length ? ` (${groupBy.length})` : ""}</Button>}>
          {() => (
            <div className="p-1">
              <p className="text-faint mb-1.5 px-1 text-[11px]">Build a hierarchy (max 4 levels)</p>
              {GROUPABLE.map((g) => {
                const i = groupBy.indexOf(g);
                return (
                  <button key={g} onClick={() => setGroupBy((gb) => (i >= 0 ? gb.filter((x) => x !== g) : gb.length < 4 ? [...gb, g] : gb))} className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-[12.5px] hover:bg-[var(--surface-2)]">
                    <span>{COLS.find((c) => c.key === g)?.label ?? g}</span>
                    {i >= 0 && <span className="rounded-full px-1.5 text-[11px]" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>{i + 1}</span>}
                  </button>
                );
              })}
              <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setGroupBy([])}>Clear grouping</Button>
            </div>
          )}
        </Popover>

        <Popover width={320} trigger={() => <Button variant="outline" size="sm"><Columns3 size={13} /> Columns ({visible.length})</Button>}>
          {() => (
            <div className="p-1">
              {GROUPS.map((g) => {
                const keys = COLS.filter((c) => c.group === g).map((c) => c.key);
                const allOn = keys.every((k) => visible.includes(k));
                return (
                  <div key={g} className="mb-2">
                    <div className="mb-1 flex items-center justify-between px-1">
                      <p className="text-faint text-[10.5px] font-semibold tracking-wide uppercase">{g}</p>
                      <button className="text-[11px] hover:underline" style={{ color: "var(--accent)" }} onClick={() => setVisible((v) => (allOn ? v.filter((k) => !keys.includes(k)) : [...new Set([...v, ...keys])]))}>{allOn ? "Hide all" : "Show all"}</button>
                    </div>
                    {COLS.filter((c) => c.group === g).map((c) => (
                      <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-[12.5px] hover:bg-[var(--surface-2)]">
                        <input type="checkbox" checked={visible.includes(c.key)} onChange={() => setVisible((v) => (v.includes(c.key) ? v.filter((x) => x !== c.key) : [...v, c.key]))} style={{ accentColor: "var(--accent)" }} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </Popover>

        <div className="flex items-center gap-1.5">
          {[
            { label: "All", v: "all" },
            { label: "Overdue", v: "overdue" },
            { label: "Missed", v: "missed" },
            { label: "Opportunities", v: "opportunities" },
          ].map((f) => (
            <button key={f.v} onClick={() => setAiFilter(f.v as typeof aiFilter)} className="rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={aiFilter === f.v ? { background: "var(--accent)", color: "var(--accent-contrast)" } : { background: "var(--surface-2)", color: "var(--text-muted)" }}>{f.label}</button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selected.length > 0 && <Button variant="primary" size="sm" onClick={() => setBulkOpen(true)}><Pencil size={13} /> Bulk edit ({selected.length})</Button>}
          <Button variant="outline" size="sm" onClick={() => exportData("csv")}><Download size={13} /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportData("xls")}><Download size={13} /> Excel</Button>
          <Button variant="ghost" size="sm" onClick={() => { setVisible(DEFAULT_VISIBLE); setOrder(COLS.map((c) => c.key)); setWidths({}); setPinned(["fullName"]); setColFilters({}); setGroupBy([]); setSort([{ field: "createdAt", dir: "desc" }]); setPage(1); }}><RotateCcw size={13} /> Reset</Button>
        </div>
      </div>

      {data && (
        <div className="card grid grid-cols-2 divide-x md:grid-cols-6">
          {[
            ["Leads in view", num(data.summary.leads)],
            ["Converted", `${num(data.summary.converted)} · ${pctStr(data.summary.conversionRate)}`],
            ["Trials", num(data.summary.trials)],
            ["Purchases (Sales)", num(data.summary.purchases)],
            ["Total LTV (Sales)", inrCompact(data.summary.ltv)],
            ["Visits (Check-ins)", num(data.summary.visits)],
          ].map(([l, v]) => <div key={l} className="px-4 py-2.5"><p className="text-faint text-[10.5px] tracking-wide uppercase">{l}</p><p className="num text-[14px] font-semibold">{v}</p></div>)}
        </div>
      )}

      {error && <Card><EmptyState title="Could not load leads" description={error} icon={<Database size={18} />} /></Card>}
      {loading && !data && <div className="card space-y-2 p-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>}

      {data?.mode === "grouped" && (
        <Card padded={false}>
          <div className="overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 z-10" style={{ background: "var(--surface-2)" }}>
                <tr className="text-faint text-[11px] tracking-wide uppercase">
                  <th className="px-4 py-2.5 text-left">Group</th><th className="px-3 py-2.5 text-right">Leads</th><th className="px-3 py-2.5 text-right">Converted</th><th className="px-3 py-2.5 text-right">Conv. rate</th><th className="px-3 py-2.5 text-right">Trials</th><th className="px-3 py-2.5 text-right">Purchases</th><th className="px-3 py-2.5 text-right">Total LTV</th><th className="px-3 py-2.5 text-right">Avg LTV</th><th className="px-3 py-2.5 text-right">Visits</th>
                </tr>
              </thead>
              <tbody>{data.groups.map((g) => <GroupRows key={g.path} node={g} expanded={expanded} toggle={(p) => setExpanded((e) => (e.includes(p) ? e.filter((x) => x !== p) : [...e, p]))} onLead={setDetail} />)}</tbody>
            </table>
          </div>
        </Card>
      )}

      {data?.mode === "flat" && (
        <Card padded={false}>
          <div className="overflow-auto" style={{ maxHeight: "68vh" }}>
            <table className="text-[12.5px]" style={{ minWidth: "100%" }}>
              <thead>
                <tr className="sticky top-0 z-20" style={{ background: "var(--surface-2)" }}>
                  <th className="sticky left-0 z-30 px-3 py-2" style={{ background: "var(--surface-2)", width: 76 }}>
                    <input type="checkbox" checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))} onChange={(e) => setSelected(e.target.checked ? [...new Set([...selected, ...rows.map((r) => r.id)])] : selected.filter((s) => !rows.some((r) => r.id === s)))} style={{ accentColor: "var(--accent)" }} />
                  </th>
                  {ordered.map((c) => {
                    const s = sort.find((x) => x.field === c.key);
                    const isPinned = pinned.includes(c.key);
                    return (
                      <th key={c.key} draggable onDragStart={() => (dragKey.current = c.key)} onDragOver={(e) => e.preventDefault()} onDrop={() => { const from = dragKey.current; if (!from || from === c.key) return; setOrder((o) => { const n = o.filter((k) => k !== from); n.splice(n.indexOf(c.key), 0, from); return n; }); }} className={cx("group relative px-3 py-2 text-left font-semibold select-none", isPinned && "sticky z-20")} style={{ width: w(c), minWidth: w(c), background: "var(--surface-2)", left: isPinned ? offsets[c.key] - w(c) : undefined, borderRight: isPinned ? "1px solid var(--border)" : undefined }}>
                        <div className="flex items-center gap-1">
                          <GripVertical size={11} className="text-faint cursor-grab opacity-0 group-hover:opacity-60" />
                          <button className="flex items-center gap-1 truncate hover:underline" onClick={(e) => toggleSort(c.key, e.shiftKey)}>{c.label}{s && <ArrowDownUp size={10} style={{ color: "var(--accent)" }} />}</button>
                          <button className="ml-auto opacity-0 group-hover:opacity-70" onClick={() => setPinned((p) => (p.includes(c.key) ? p.filter((x) => x !== c.key) : [...p, c.key]))}><Pin size={10} style={isPinned ? { color: "var(--accent)" } : undefined} /></button>
                        </div>
                        <input value={colFilters[c.key] ?? ""} onChange={(e) => { setColFilters((f) => ({ ...f, [c.key]: e.target.value })); setPage(1); }} placeholder="filter…" className="mt-1 h-6 w-full rounded-lg border bg-[var(--surface)] px-1.5 text-[11px] font-normal" />
                        <span onMouseDown={(e) => { const startX = e.clientX; const startW = w(c); const move = (ev: MouseEvent) => setWidths((wd) => ({ ...wd, [c.key]: Math.max(70, startW + ev.clientX - startX) })); const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); }; document.addEventListener("mousemove", move); document.addEventListener("mouseup", up); }} className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-[var(--accent)]" />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const cad = cadenceBadge(l);
                  const isOverdue = cad.tone === "critical";
                  return (
                    <React.Fragment key={l.id + l.rowIndex}>
                      <tr className={cx("group border-t transition-colors hover:bg-[var(--surface-2)]", isOverdue && "bg-[var(--critical-soft)]/40")} style={selected.includes(l.id) ? { background: "var(--accent-soft)" } : undefined}>
                        <td className="sticky left-0 z-10 px-3 py-2" style={{ background: "var(--surface)", width: 76 }}>
                          <div className="flex items-center gap-1">
                            <input type="checkbox" checked={selected.includes(l.id)} onChange={() => setSelected((s) => (s.includes(l.id) ? s.filter((x) => x !== l.id) : [...s, l.id]))} style={{ accentColor: "var(--accent)" }} />
                            <button onClick={() => setOpenRow(openRow === l.id ? null : l.id)} className="text-faint">{openRow === l.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
                            {isOverdue && <AlertTriangle size={11} style={{ color: "var(--critical)" }} />}
                          </div>
                        </td>
                        {ordered.map((c) => {
                          const isPinned = pinned.includes(c.key);
                          const raw = (l as unknown as Record<string, unknown>)[c.key];
                          return (
                            <td key={c.key} onClick={() => c.key !== "inlineFU" && setDetail(l)} className={cx("truncate px-3 py-2", c.align === "right" && "text-right num", c.key !== "inlineFU" && "cursor-pointer", isPinned && "sticky z-10 font-medium")} style={{ width: w(c), maxWidth: w(c), left: isPinned ? offsets[c.key] - w(c) : undefined, background: isPinned ? "var(--surface)" : undefined, borderRight: isPinned ? "1px solid var(--border)" : undefined }}>
                              {c.render ? c.render(l) : String(raw ?? "") || <span className="text-faint">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                      {openRow === l.id && (
                        <tr><td colSpan={ordered.length + 1} className="px-6 py-3" style={{ background: "var(--surface-2)" }}>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-faint mb-1.5 text-[11px] font-semibold uppercase">Follow-up records (inline editable above)</p>
                              <table className="w-full text-[12px]"><tbody>{l.followUps.map((f, i) => <tr key={i} className="border-t"><td className="py-1 pr-3 font-medium">FU {i + 1}</td><td className="num py-1 pr-3">{f.date ? fmtDate(f.date) : "—"}</td><td className="text-muted py-1">{f.comment || "—"}</td></tr>)}</tbody></table>
                              {l.crossSheetFlags?.length ? <div className="mt-2 flex flex-wrap gap-1">{l.crossSheetFlags.map((f) => <Chip key={f} tone="critical"><ShieldAlert size={10} /> {f}</Chip>)}</div> : null}
                            </div>
                            <div>
                              <p className="text-faint mb-1.5 text-[11px] font-semibold uppercase">Commercial & lifecycle (Sales/Check-ins truth)</p>
                              <div className="grid grid-cols-3 gap-2 text-[12px]">
                                {[
                                  ["Purchases", num(l.purchases)],
                                  ["LTV", inr(l.ltv)],
                                  ["Visits", num(l.visits)],
                                  ["Trial", l.trialStatus],
                                  ["Conversion", l.conversionStatus],
                                  ["Retention", l.retentionStatus],
                                ].map(([a, b]) => <div key={a} className="card px-2.5 py-1.5"><p className="text-faint text-[10.5px]">{a}</p><p className="num truncate font-medium">{b}</p></div>)}
                              </div>
                              {l.issues.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{l.issues.slice(0, 6).map((i) => <Chip key={i} tone="warning">{i}</Chip>)}</div>}
                              {l.enriched && <p className="text-faint mt-2 flex items-center gap-1 text-[11px]"><Bot size={11} /> Enriched from Sales/Check-ins truth · Raw LTV {inr(l.rawLtv)} → {inr(l.ltv)}</p>}
                            </div>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && !loading && <EmptyState title="No leads match the current filters" description="Loosen a filter or reset the view to see records again." icon={<Database size={18} />} />}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2.5 text-[12px]">
            <span className="text-muted num">Page {data.page} of {totalPages} · {data.total.toLocaleString()} records{aiFilter !== "all" ? ` · AI filter: ${aiFilter}` : ""}</span>
            <div className="ml-auto flex items-center gap-2">
              <Select className="w-[104px]" value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(1); }} options={[25, 50, 100, 250, 500].map((n) => ({ value: String(n), label: `${n} / page` }))} />
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>First</Button>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</Button>
            </div>
          </div>
        </Card>
      )}

      <LeadDrawer lead={detail} onClose={() => setDetail(null)} onSaved={bumpRefresh} />
      <BulkEditDrawer open={bulkOpen} ids={selected} onClose={() => setBulkOpen(false)} onDone={() => { setSelected([]); bumpRefresh(); }} />
    </div>
  );
}

function GroupRows({ node, expanded, toggle, onLead }: { node: GroupNode; expanded: string[]; toggle: (p: string) => void; onLead: (l: Lead) => void }) {
  const open = expanded.includes(node.path);
  return (
    <>
      <tr className="border-t hover:bg-[var(--surface-2)]">
        <td className="px-4 py-2" style={{ paddingLeft: 16 + node.depth * 20 }}>
          <button className="flex items-center gap-1.5 text-left font-medium" onClick={() => toggle(node.path)}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<span className="truncate">{node.label}</span><span className="text-faint text-[11px]">({node.field})</span></button>
        </td>
        <td className="num px-3 py-2 text-right font-semibold">{num(node.summary.leads)}</td>
        <td className="num px-3 py-2 text-right">{num(node.summary.converted)}</td>
        <td className="num px-3 py-2 text-right" style={{ color: node.summary.conversionRate > 20 ? "var(--positive)" : undefined }}>{pctStr(node.summary.conversionRate)}</td>
        <td className="num px-3 py-2 text-right">{num(node.summary.trials)}</td>
        <td className="num px-3 py-2 text-right">{num(node.summary.purchases)}</td>
        <td className="num px-3 py-2 text-right">{inrCompact(node.summary.ltv)}</td>
        <td className="num px-3 py-2 text-right">{inrCompact(node.summary.avgLtv)}</td>
        <td className="num px-3 py-2 text-right">{num(node.summary.visits)}</td>
      </tr>
      {open && node.children?.map((c) => <GroupRows key={c.path} node={c} expanded={expanded} toggle={toggle} onLead={onLead} />)}
      {open && node.leads && (
        <tr><td colSpan={9} className="px-4 py-2" style={{ background: "var(--surface-2)" }}>
          <div className="max-h-72 overflow-auto rounded-xl border" style={{ background: "var(--surface)" }}>
            <table className="w-full text-[12px]"><thead className="text-faint text-[10.5px] uppercase"><tr>{["Lead", "Created", "Stage", "Associate", "Conversion", "LTV"].map((h) => <th key={h} className="px-3 py-1.5 text-left">{h}</th>)}</tr></thead>
              <tbody>{node.leads.map((l) => <tr key={l.id + l.rowIndex} className="cursor-pointer border-t hover:bg-[var(--surface-2)]" onClick={() => onLead(l)}><td className="px-3 py-1.5 font-medium">{l.fullName || l.id}</td><td className="num px-3 py-1.5">{fmtDate(l.createdAt)}</td><td className="px-3 py-1.5">{l.stageName}</td><td className="px-3 py-1.5">{l.associate}</td><td className="px-3 py-1.5">{l.conversionStatus}</td><td className="num px-3 py-1.5">{inr(l.ltv)}</td></tr>)}</tbody>
            </table>
            {node.leads.length >= 200 && <p className="text-faint px-3 py-1.5 text-[11px]">Showing the first 200 leads in this group.</p>}
          </div>
        </td></tr>
      )}
    </>
  );
}

const BULK_FIELDS = ["associate", "center", "classType", "stageName", "status", "retentionStatus", "remarks"];

function BulkEditDrawer({ open, ids, onClose, onDone }: { open: boolean; ids: string[]; onClose: () => void; onDone: () => void }) {
  const [patch, setPatch] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<{ id: string; ok: boolean; message: string }[]>([]);
  const run = async () => {
    setRunning(true); setLog([]);
    const res = await fetch("/api/momence", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates: ids.map((id) => ({ id, patch })) }) });
    const j = await res.json(); setLog(j.results ?? []); setRunning(false); onDone();
  };
  return (
    <Drawer open={open} onClose={onClose} title={`Bulk edit ${ids.length} lead${ids.length === 1 ? "" : "s"}`} subtitle="Each record is pushed to Momence with an individual PUT request" footer={
      <div className="flex items-center justify-between"><span className="text-faint text-[11.5px]">{log.length ? `${log.filter((l) => l.ok).length} succeeded · ${log.filter((l) => !l.ok).length} failed` : "Only fields you fill in will be changed"}</span><Button variant="primary" size="sm" onClick={run} disabled={running || !Object.keys(patch).length}>{running ? "Pushing…" : `Apply to ${ids.length}`}</Button></div>
    }>
      <div className="space-y-3">
        {BULK_FIELDS.map((f) => <div key={f}><p className="text-faint mb-1 text-[11px]">{f}</p><Input placeholder="leave blank to keep existing" value={patch[f] ?? ""} onChange={(e) => { const v = e.target.value; setPatch((p) => { const n = { ...p }; if (v) n[f] = v; else delete n[f]; return n; }); }} /></div>)}
        {log.length > 0 && <div className="card max-h-64 divide-y overflow-auto">{log.map((l) => <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12px]"><span className="num">{l.id}</span><span style={{ color: l.ok ? "var(--positive)" : "var(--critical)" }} className="truncate">{l.message}</span></div>)}</div>}
      </div>
    </Drawer>
  );
}
