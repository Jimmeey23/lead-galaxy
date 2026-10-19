"use client";

import { useState } from "react";
import type { Kpis, PeriodMetrics } from "@/lib/metrics";
import { days, fmtDate, inr, num, pctStr } from "@/lib/format";
import { Card } from "./ui";

const metrics: { key: keyof Kpis; label: string; kind: "count" | "rate" | "money" | "days" | "average" }[] = [
  { key: "totalLeads", label: "Leads", kind: "count" },
  { key: "won", label: "Won", kind: "count" },
  { key: "trials", label: "Trials completed", kind: "count" },
  { key: "trialRate", label: "Trial rate", kind: "rate" },
  { key: "converted", label: "Eligible conversions", kind: "count" },
  { key: "conversionRate", label: "Conversion rate", kind: "rate" },
  { key: "purchases", label: "Purchases", kind: "count" },
  { key: "totalLtv", label: "Total LTV", kind: "money" },
  { key: "avgLtvPerLead", label: "Avg LTV / lead", kind: "money" },
  { key: "avgLtvPerConverted", label: "Avg LTV / converted", kind: "money" },
  { key: "visits", label: "Visits", kind: "count" },
  { key: "retained", label: "Retained", kind: "count" },
  { key: "retentionRate", label: "Retention rate", kind: "rate" },
  { key: "avgTimeToConversion", label: "Avg time to conversion", kind: "days" },
  { key: "followUpCoverage", label: "Follow-up coverage", kind: "rate" },
  { key: "avgFollowUps", label: "Avg follow-ups", kind: "average" },
  { key: "avgDaysToFirstFollowUp", label: "Avg first follow-up delay", kind: "days" },
];

function PeriodTable({ rows, weekly }: { rows: PeriodMetrics[]; weekly: boolean }) {
  const [changes, setChanges] = useState(true);
  return <Card title={weekly ? "Week-on-week metrics" : "Month-on-month metrics"} subtitle={weekly ? "Monday–Sunday weeks · all active filters apply" : "Calendar months · all active filters apply"}>
    <p className="text-muted mb-3 text-xs">Grouped by lead creation date. Outcomes and lifetime values reflect the latest synced data for each cohort, rather than activity occurring in that period. Boundary periods may be partial; leads without a creation date are excluded.</p>
    <label className="mb-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={changes} onChange={(event) => setChanges(event.target.checked)} />Show change from previous calendar {weekly ? "week" : "month"}</label>
    {rows.length === 0 ? <p className="text-muted py-6 text-sm">No dated leads match the current filters.</p> : <div className="max-h-[540px] overflow-auto rounded-xl border" tabIndex={0} role="region" aria-label={weekly ? "Week-on-week metrics table" : "Month-on-month metrics table"}>
      <table className="w-full whitespace-nowrap text-xs">
        <thead className="sticky top-0 z-20 bg-[var(--surface)]"><tr><th scope="col" className="sticky left-0 z-30 bg-[var(--surface)] p-3 text-left">{weekly ? "Week starting" : "Month"}</th>{metrics.map((metric) => <th scope="col" key={metric.key} className="p-3 text-right">{metric.label}</th>)}</tr></thead>
        <tbody>{[...rows].reverse().map((row, index) => {
          const previous = rows[rows.length - index - 2];
          return <tr key={row.date} className="border-t"><th scope="row" className="sticky left-0 z-10 bg-[var(--surface)] p-3 text-left font-medium">{weekly ? fmtDate(row.date) : new Date(row.date + "T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}</th>{metrics.map((metric) => {
            const value = row.kpis[metric.key];
            const prior = previous?.kpis[metric.key];
            const formatted = metric.kind === "money" ? inr(value) : metric.kind === "rate" ? pctStr(value) : metric.kind === "days" ? days(value) : num(value, metric.kind === "average" ? 1 : 0);
            let change = "—";
            if (value != null && prior != null) {
              const difference = value - prior;
              if (metric.kind === "rate") change = `${difference > 0 ? "+" : ""}${num(difference, 1)} pp`;
              else if (prior !== 0) change = `${difference > 0 ? "+" : ""}${pctStr(difference / Math.abs(prior) * 100)}`;
              else change = value === 0 ? "0.0%" : "New";
            }
            return <td key={metric.key} className="num p-3 text-right">{formatted}{changes && <span className="text-muted mt-1 block text-[10px]">{change}</span>}</td>;
          })}</tr>;
        })}</tbody>
      </table>
    </div>}
    {changes && <p className="text-muted mt-2 text-[11px]">Rates show percentage-point changes (pp); other metrics show percentage changes. New means the prior value was zero. — means no comparison is available.</p>}
  </Card>;
}

export function PeriodTables({ periods }: { periods: { month: PeriodMetrics[]; week: PeriodMetrics[] } }) {
  return <div className="space-y-4"><PeriodTable rows={periods.month} weekly={false} /><PeriodTable rows={periods.week} weekly /></div>;
}
