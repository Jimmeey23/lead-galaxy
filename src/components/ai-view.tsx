"use client";

import React, { useState } from "react";
import { AlertTriangle, Bot, Clock, Mail, Phone, Target, Zap, ShieldAlert, ArrowRight } from "lucide-react";
import { Card, Chip, Button, EmptyState, IconBadge, GraphicKpi } from "./ui";
import { cx, num, pctStr, fmtDate } from "@/lib/format";
import type { Analytics } from "./modules";
import type { FilterState } from "@/lib/types";

export function AIView({ a, drill, onOpenLead }: { a: Analytics; drill: (p: Partial<FilterState>) => void; onOpenLead?: (id: string) => void }) {
  const ai = a.ai;
  const [tab, setTab] = useState<"missedFU" | "opportunities" | "discrepancies" | "anomalies">("missedFU");

  const toneForStatus = (s: string) => s === "missed" ? "critical" as const : s === "overdue" ? "warning" as const : s === "due-today" ? "warning" as const : "neutral" as const;

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <IconBadge tone="accent"><Bot size={14} /></IconBadge>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">AI Intelligence Engine</p>
          <p className="text-muted text-[11.5px]">Live detection across cadence, conversion truth, visit behaviour and lifecycle anomalies — recomputed on every filter change.</p>
        </div>
        <div className="flex gap-2">
          <Chip tone="critical">{ai.summary.missed} missed</Chip>
          <Chip tone="warning">{ai.summary.overdue} overdue</Chip>
          <Chip tone="accent">{ai.summary.discrepancyCount} discrepancies</Chip>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GraphicKpi label="Missed follow-ups" value={num(ai.missedFollowups.length)} sub="sorted by overdue days" icon={<Clock size={14} />} tone="critical" />
        <GraphicKpi label="Missed opportunities" value={num(ai.missedOpportunities.length)} sub="high-intent unconverted" icon={<Target size={14} />} tone="warning" />
        <GraphicKpi label="Cross-sheet discrepancies" value={num(ai.summary.discrepancyCount)} sub="Sales/Check-ins truth vs sheet" icon={<ShieldAlert size={14} />} tone="critical" />
        <GraphicKpi label="Anomalies" value={num(ai.summary.anomalyCount)} sub="implausible patterns" icon={<Zap size={14} />} tone="info" />
      </div>

      <Card title="AI actions">
        <div className="flex flex-wrap gap-1.5">
          {(["missedFU", "opportunities", "discrepancies", "anomalies"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx("rounded-full px-3 py-1.5 text-[12.5px] font-medium", tab === t ? "text-[var(--accent-contrast)]" : "border hover:bg-[var(--surface-2)]")} style={tab === t ? { background: "var(--accent)" } : undefined}>
              {t === "missedFU" ? `Missed follow-ups (${ai.missedFollowups.length})` : t === "opportunities" ? `Missed opportunities (${ai.missedOpportunities.length})` : t === "discrepancies" ? `Discrepancies (${ai.discrepancies.length})` : `Anomalies (${ai.anomalies.length})`}
            </button>
          ))}
        </div>
      </Card>

      {tab === "missedFU" && (
        <Card
          title="Missed & overdue follow-ups"
          subtitle={
            a.meta.cadence
              ? `FU1 due ${a.meta.cadence.fu1FromCreate}d after creation, FU2 ${a.meta.cadence.fu2Gap}d after FU1, FU3 ${a.meta.cadence.fu3Gap}d, FU4 ${a.meta.cadence.fu4Gap}d. Configurable in Settings · computed against Asia/Kolkata today.`
              : "Cadence configurable in Settings. Overdue computed against Asia/Kolkata today."
          }
        >
          <LeadAITable
            rows={ai.missedFollowups}
            columns={["cadence", "overdue", "nextAction", "risk"]}
            onOpenLead={onOpenLead}
          />
        </Card>
      )}

      {tab === "opportunities" && (
        <Card title="Missed opportunities" subtitle="Unconverted leads with strong visit/trial signals and opportunity score ≥70 — your fastest re-activation wins.">
          <LeadAITable rows={ai.missedOpportunities} columns={["opportunity", "cadence", "risk"]} onOpenLead={onOpenLead} />
        </Card>
      )}

      {tab === "discrepancies" && (
        <Card title="Cross-sheet discrepancies" subtitle="Where the Leads sheet disagrees with Sales/Check-ins truth — Sales truth governs KPIs.">
          {ai.discrepancies.length ? (
            <div className="overflow-auto rounded-xl border">
              <table className="w-full text-[12.5px]">
                <thead style={{ background: "var(--surface-2)" }}><tr className="text-faint text-[10.5px] uppercase"><th className="px-3 py-2 text-left">Lead</th><th className="px-3 py-2 text-left">Centre / Associate</th><th className="px-3 py-2 text-left">Issue</th><th className="px-3 py-2 text-left">Next action</th></tr></thead>
                <tbody>
                  {ai.discrepancies.slice(0, 120).map((d) => (
                    <tr key={d.id} className="cursor-pointer border-t hover:bg-[var(--surface-2)]" onClick={() => onOpenLead?.(d.id)}>
                      <td className="px-3 py-2"><div className="font-medium">{d.fullName || d.id}</div><div className="text-faint text-[11px]">{d.id}</div></td>
                      <td className="px-3 py-2">{d.center}<div className="text-faint text-[11px]">{d.associate}</div></td>
                      <td className="px-3 py-2 text-[11.5px]">{d.discrepancy}</td>
                      <td className="px-3 py-2 text-[11.5px]">{d.nextAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No discrepancies in this population" description="Sales and visit truth align with the Leads sheet here." icon={<ShieldAlert size={17} />} />}
        </Card>
      )}

      {tab === "anomalies" && (
        <Card title="Lifecycle anomalies" subtitle="High-visit unconverted, zero-visit converted, visit spikes and other statistical outliers.">
          {ai.anomalies.length ? (
            <div className="overflow-auto rounded-xl border">
              <table className="w-full text-[12.5px]">
                <thead style={{ background: "var(--surface-2)" }}><tr className="text-faint text-[10.5px] uppercase"><th className="px-3 py-2 text-left">Lead</th><th className="px-3 py-2 text-left">Stage</th><th className="px-3 py-2 text-left">Anomaly</th><th className="px-3 py-2 text-left">Next action</th></tr></thead>
                <tbody>
                  {ai.anomalies.slice(0, 120).map((d) => (
                    <tr key={d.id} className="cursor-pointer border-t hover:bg-[var(--surface-2)]" onClick={() => onOpenLead?.(d.id)}>
                      <td className="px-3 py-2 font-medium">{d.fullName || d.id}</td>
                      <td className="px-3 py-2">{d.stageName}</td>
                      <td className="px-3 py-2">{d.anomaly}</td>
                      <td className="px-3 py-2">{d.nextAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No anomalies detected" icon={<Zap size={17} />} />}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Risk by associate" subtitle="Average risk score and overdue count">
          <div className="space-y-2">
            {ai.riskByAssociate.slice(0, 10).map((r) => (
              <div key={r.key} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                <span className="flex-1 truncate text-[12.5px] font-medium">{r.key}</span>
                <span className="text-faint text-[11px]">{r.leads} leads</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: r.avgRisk > 60 ? "var(--critical-soft)" : r.avgRisk > 35 ? "var(--warning-soft)" : "var(--positive-soft)", color: r.avgRisk > 60 ? "var(--critical)" : r.avgRisk > 35 ? "var(--warning)" : "var(--positive)" }}>{r.avgRisk.toFixed(0)} risk</span>
                <Chip tone={r.overdue ? "warning" : "neutral"}>{r.overdue} overdue</Chip>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Risk by centre" subtitle="Cross-studio cadence health">
          <div className="space-y-2">
            {ai.riskByCenter.slice(0, 10).map((r) => (
              <div key={r.key} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                <span className="flex-1 truncate text-[12.5px] font-medium">{r.key}</span>
                <span className="text-faint text-[11px]">{r.leads} leads</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: r.avgRisk > 60 ? "var(--critical-soft)" : r.avgRisk > 35 ? "var(--warning-soft)" : "var(--positive-soft)", color: r.avgRisk > 60 ? "var(--critical)" : r.avgRisk > 35 ? "var(--warning)" : "var(--positive)" }}>{r.avgRisk.toFixed(0)} risk</span>
                <Chip tone={r.overdue ? "warning" : "neutral"}>{r.overdue} overdue</Chip>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="AI playbook"><div className="grid gap-2 md:grid-cols-2">{ai.recommendations.map((r, i) => <div key={i} className="rounded-xl border p-3"><p className="text-[12.5px] font-semibold">{r.title}</p><p className="text-muted mt-1 text-[12px]">{r.description}</p><p className="mt-1 text-[11.5px]" style={{ color: "var(--accent)" }}>→ {r.action}</p></div>)}</div></Card>
    </div>
  );
}

function LeadAITable({
  rows,
  columns,
  onOpenLead,
}: {
  rows: { id: string; fullName: string; associate: string; center: string; status: string; nextDue: string | null; overdueBy: number | null; nextAction: string; riskScore: number; opportunityScore: number; expected: { label: string; expectedDate: string | null; actual: string | null; state: string }[]; createdAt: string | null; stageName: string }[];
  columns: string[];
  onOpenLead?: (id: string) => void;
}) {
  if (!rows.length) return <EmptyState title="Nothing to show in this slice" icon={<Bot size={17} />} />;
  return (
    <div className="overflow-auto rounded-xl border">
      <table className="w-full text-[12.5px]">
        <thead style={{ background: "var(--surface-2)" }}>
          <tr className="text-faint text-[10.5px] uppercase">
            <th className="px-3 py-2 text-left">Lead</th>
            <th className="px-3 py-2 text-left">Cadence</th>
            <th className="px-3 py-2 text-left">Expected</th>
            <th className="px-3 py-2 text-left">Next action</th>
            <th className="px-3 py-2 text-right">Risk</th>
            <th className="px-3 py-2 text-right">Opportunity</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((r) => (
            <tr key={r.id} className="cursor-pointer border-t hover:bg-[var(--surface-2)]" onClick={() => onOpenLead?.(r.id)}>
              <td className="px-3 py-2">
                <div className="font-medium">{r.fullName || r.id}</div>
                <div className="text-faint text-[11px]">{r.center} · {r.associate} · {r.createdAt ? fmtDate(r.createdAt) : "no date"}</div>
              </td>
              <td className="px-3 py-2">
                <Chip tone={r.status === "missed" ? "critical" : r.status === "overdue" ? "warning" : r.status === "complete" ? "positive" : "neutral"}>{r.status}</Chip>
                {r.overdueBy != null && r.status !== "on-track" && <div className="text-faint mt-1 text-[11px]">{r.overdueBy}d overdue{ r.nextDue ? ` · due ${fmtDate(r.nextDue)}` : ""}</div>}
                <div className="mt-1 flex gap-1">
                  {r.expected.map((e) => (
                    <span key={e.label} className="inline-flex h-2.5 w-2.5 rounded-full" title={`${e.label}: ${e.state} ${e.actual ? `(${e.actual})` : `(expected ${e.expectedDate})`}`} style={{ background: e.state === "done" ? "var(--positive)" : e.state === "overdue" ? "var(--critical)" : e.state === "due" ? "var(--warning)" : "var(--border-strong)" }} />
                  ))}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col gap-0.5 text-[11.5px]">
                  {r.expected.slice(0,4).map((e) => (
                    <span key={e.label} className="flex justify-between gap-2"><span className="text-muted">{e.label}</span><span className={cx(e.state === "done" ? "text-[var(--positive)]" : e.state === "overdue" ? "text-[var(--critical)] font-medium" : "text-faint")}>{e.actual ? fmtDate(e.actual) : e.expectedDate ? `due ${fmtDate(e.expectedDate)}` : "—"}</span></span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 text-[11.5px] leading-snug">{r.nextAction}</td>
              <td className="num px-3 py-2 text-right"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: r.riskScore > 70 ? "var(--critical-soft)" : r.riskScore > 40 ? "var(--warning-soft)" : "var(--positive-soft)", color: r.riskScore > 70 ? "var(--critical)" : r.riskScore > 40 ? "var(--warning)" : "var(--positive)" }}>{r.riskScore}</span></td>
              <td className="num px-3 py-2 text-right">{r.opportunityScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
