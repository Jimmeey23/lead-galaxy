"use client";

import React, { useState } from "react";
import {
  CalendarDays,
  Filter,
  Moon,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sun,
  Trash2,
} from "lucide-react";
import { Button, Chip, Drawer, Input, MultiSelect, Popover, Select, Toggle } from "./ui";
import { useApp } from "@/lib/store";
import { DATE_PRESETS, resolveRange } from "@/lib/filters";
import { cx, fmtDate, fmtDateTime } from "@/lib/format";
import type { AdvCond, FilterState } from "@/lib/types";

export type Facets = Record<string, string[]>;

const MULTI_FIELDS: { key: keyof FilterState; label: string; facet: string }[] = [
  { key: "center", label: "Center", facet: "center" },
  { key: "associate", label: "Associate", facet: "associate" },
  { key: "sourceName", label: "Source", facet: "sourceName" },
  { key: "channel", label: "Channel", facet: "channel" },
  { key: "stageName", label: "Stage", facet: "stageName" },
  { key: "status", label: "Status", facet: "status" },
  { key: "trialStatus", label: "Trial status", facet: "trialStatus" },
  { key: "conversionStatus", label: "Conversion", facet: "conversionStatus" },
  { key: "retentionStatus", label: "Retention", facet: "retentionStatus" },
  { key: "classType", label: "Class type", facet: "classType" },
  { key: "utmCampaign", label: "Campaign", facet: "utmCampaign" },
  { key: "utmSource", label: "UTM source", facet: "utmSource" },
  { key: "utmMedium", label: "UTM medium", facet: "utmMedium" },
];

const ADV_FIELDS = [
  "center","associate","sourceName","channel","stageName","status","trialStatus",
  "conversionStatus","retentionStatus","classType","utmCampaign","utmSource","utmMedium",
  "fullName","email","phone","remarks","ltv","visits","purchases","followUpCount",
];
const ADV_OPS = [
  { value: "is", label: "is" },
  { value: "isNot", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "notContains", label: "does not contain" },
  { value: "empty", label: "is empty" },
  { value: "notEmpty", label: "is not empty" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
];

export function DateControl() {
  const { filters, patch } = useApp();
  const range = resolveRange(filters.preset, filters.from, filters.to);
  return (
    <Popover
      width={330}
      align="right"
      trigger={() => (
        <button className="focus-ring flex h-9 items-center gap-2 rounded-lg border bg-[var(--surface)] px-3 text-[13px] hover:bg-[var(--surface-2)]">
          <CalendarDays size={14} style={{ color: "var(--accent)" }} />
          <span className="font-medium">{filters.preset}</span>
          <span className="text-faint hidden text-[11.5px] md:inline">
            {range.from ? `${fmtDate(range.from)} → ${fmtDate(range.to)}` : "complete history"}
          </span>
        </button>
      )}
    >
      {() => (
        <div className="space-y-3 p-1">
          <div>
            <p className="text-faint mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
              Date dimension
            </p>
            <Select
              value={filters.dateDimension}
              onChange={(v) => patch({ dateDimension: v as FilterState["dateDimension"] })}
              options={[
                { value: "createdAt", label: "Lead Created At" },
                { value: "convertedAt", label: "Converted To Customer At" },
                { value: "followUp", label: "First Follow-up Date" },
              ]}
            />
          </div>
          <div>
            <p className="text-faint mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
              Quick ranges
            </p>
            <div className="grid grid-cols-2 gap-1">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => patch({ preset: p })}
                  className={cx(
                    "rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                    filters.preset === p ? "font-semibold" : "hover:bg-[var(--surface-2)]",
                  )}
                  style={
                    filters.preset === p
                      ? { background: "var(--accent-soft)", color: "var(--accent)" }
                      : undefined
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-faint mb-1 text-[11px]">From</p>
              <Input
                type="date"
                value={filters.from ?? ""}
                onChange={(e) => patch({ from: e.target.value, preset: "Custom Range" })}
              />
            </div>
            <div>
              <p className="text-faint mb-1 text-[11px]">To</p>
              <Input
                type="date"
                value={filters.to ?? ""}
                onChange={(e) => patch({ to: e.target.value, preset: "Custom Range" })}
              />
            </div>
          </div>
          <div>
            <p className="text-faint mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
              Compare against
            </p>
            <Select
              value={filters.compare ?? "none"}
              onChange={(v) => patch({ compare: v })}
              options={[
                { value: "none", label: "No comparison" },
                { value: "previous", label: "Previous period" },
                { value: "lastMonth", label: "Same period last month" },
                { value: "lastYear", label: "Same period last year" },
              ]}
            />
          </div>
          <p className="text-faint px-1 text-[11px]">
            Reporting timezone: Asia/Kolkata. Boundaries are inclusive.
          </p>
        </div>
      )}
    </Popover>
  );
}

export function ActiveChips() {
  const { filters, patch, reset } = useApp();
  const chips: { label: string; clear: () => void }[] = [];
  for (const f of MULTI_FIELDS) {
    const v = filters[f.key] as string[] | undefined;
    if (v?.length)
      chips.push({
        label: `${f.label}: ${v.length > 2 ? `${v.length} selected` : v.join(", ")}`,
        clear: () => patch({ [f.key]: [] } as Partial<FilterState>),
      });
  }
  if (filters.search) chips.push({ label: `Search: ${filters.search}`, clear: () => patch({ search: "" }) });
  if (filters.ltvMin != null) chips.push({ label: `LTV ≥ ${filters.ltvMin}`, clear: () => patch({ ltvMin: null }) });
  if (filters.ltvMax != null) chips.push({ label: `LTV ≤ ${filters.ltvMax}`, clear: () => patch({ ltvMax: null }) });
  if (filters.visitsMin != null) chips.push({ label: `Visits ≥ ${filters.visitsMin}`, clear: () => patch({ visitsMin: null }) });
  if (filters.purchasesMin != null) chips.push({ label: `Purchases ≥ ${filters.purchasesMin}`, clear: () => patch({ purchasesMin: null }) });
  if (filters.followUpActivity && filters.followUpActivity !== "any")
    chips.push({ label: `Follow-ups: ${filters.followUpActivity}`, clear: () => patch({ followUpActivity: "any" }) });
  if (filters.advanced?.conditions.length)
    chips.push({
      label: `${filters.advanced.conditions.length} advanced rule(s)`,
      clear: () => patch({ advanced: { combinator: "AND", conditions: [] } }),
    });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3">
      {chips.map((c, i) => (
        <Chip key={i} tone="accent" onRemove={c.clear}>
          {c.label}
        </Chip>
      ))}
      <button
        onClick={reset}
        className="text-faint ml-1 inline-flex items-center gap-1 text-[11.5px] hover:underline"
      >
        <RotateCcw size={11} /> Reset all
      </button>
    </div>
  );
}

export function FilterDrawer({
  open,
  onClose,
  facets,
}: {
  open: boolean;
  onClose: () => void;
  facets: Facets;
}) {
  const { filters, patch, reset, savedViews, saveView, applyView, deleteView } = useApp();
  const [name, setName] = useState("");
  const adv = filters.advanced ?? { combinator: "AND" as const, conditions: [] };
  const setCond = (i: number, c: Partial<AdvCond>) =>
    patch({
      advanced: {
        ...adv,
        conditions: adv.conditions.map((x, j) => (j === i ? { ...x, ...c } : x)),
      },
    });
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Filters & saved views"
      subtitle="Refine the analytical population across every module"
      width={520}
      footer={
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw size={13} /> Reset
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Apply & close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-faint)" }}>
            Dimensions
          </p>
          <div className="grid grid-cols-2 gap-2">
            {MULTI_FIELDS.map((f) => (
              <MultiSelect
                key={String(f.key)}
                label={f.label}
                options={facets[f.facet] ?? []}
                value={(filters[f.key] as string[]) ?? []}
                onChange={(v) => patch({ [f.key]: v } as Partial<FilterState>)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-faint)" }}>
            Numeric ranges
          </p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["ltvMin", "LTV minimum"],
              ["ltvMax", "LTV maximum"],
              ["visitsMin", "Visits minimum"],
              ["visitsMax", "Visits maximum"],
              ["purchasesMin", "Purchases minimum"],
            ] as const).map(([k, label]) => (
              <div key={k}>
                <p className="text-faint mb-1 text-[11px]">{label}</p>
                <Input
                  type="number"
                  value={(filters[k] as number | null) ?? ""}
                  onChange={(e) =>
                    patch({ [k]: e.target.value === "" ? null : Number(e.target.value) } as Partial<FilterState>)
                  }
                />
              </div>
            ))}
            <div>
              <p className="text-faint mb-1 text-[11px]">Follow-up activity</p>
              <Select
                value={filters.followUpActivity ?? "any"}
                onChange={(v) => patch({ followUpActivity: v })}
                options={[
                  { value: "any", label: "Any" },
                  { value: "none", label: "No recorded follow-up" },
                  { value: "withFollowUps", label: "At least one" },
                  { value: "1", label: "Exactly 1" },
                  { value: "2", label: "Exactly 2" },
                  { value: "3", label: "Exactly 3" },
                  { value: "4", label: "Exactly 4" },
                ]}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-faint)" }}>
              Advanced rule builder
            </p>
            <Toggle
              size="sm"
              value={adv.combinator}
              onChange={(v) => patch({ advanced: { ...adv, combinator: v as "AND" | "OR" } })}
              options={[
                { value: "AND", label: "Match all" },
                { value: "OR", label: "Match any" },
              ]}
            />
          </div>
          <div className="space-y-2">
            {adv.conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Select
                  className="w-[34%]"
                  value={c.field}
                  onChange={(v) => setCond(i, { field: v })}
                  options={ADV_FIELDS.map((f) => ({ value: f, label: f }))}
                />
                <Select
                  className="w-[30%]"
                  value={c.op}
                  onChange={(v) => setCond(i, { op: v })}
                  options={ADV_OPS}
                />
                <Input
                  className="flex-1"
                  value={c.value}
                  placeholder="value"
                  disabled={c.op === "empty" || c.op === "notEmpty"}
                  onChange={(e) => setCond(i, { value: e.target.value })}
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    patch({ advanced: { ...adv, conditions: adv.conditions.filter((_, j) => j !== i) } })
                  }
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                patch({
                  advanced: {
                    ...adv,
                    conditions: [...adv.conditions, { field: "center", op: "is", value: "" }],
                  },
                })
              }
            >
              + Add condition
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-faint)" }}>
            Saved views
          </p>
          <div className="space-y-1.5">
            {savedViews.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-[12.5px] hover:bg-[var(--surface-2)]"
              >
                <button className="flex-1 text-left" onClick={() => applyView(v)}>
                  {v.name}
                  {v.id.startsWith("bi-") && (
                    <span className="text-faint ml-2 text-[10.5px] uppercase">built-in</span>
                  )}
                </button>
                {!v.id.startsWith("bi-") && (
                  <button onClick={() => deleteView(v.id)} className="text-faint hover:text-[var(--critical)]">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input placeholder="Name this view…" value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              variant="subtle"
              onClick={() => {
                if (name.trim()) {
                  saveView(name.trim(), "");
                  setName("");
                }
              }}
            >
              <Save size={13} /> Save
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

export function TopBar({
  title,
  subtitle,
  facets,
  syncedAt,
  filteredRows,
  totalRows,
  onRefresh,
  refreshing,
}: {
  title: string;
  subtitle: string;
  facets: Facets;
  syncedAt: string | null;
  filteredRows: number;
  totalRows: number;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { filters, patch, theme, setTheme } = useApp();
  const [drawer, setDrawer] = useState(false);
  const activeCount =
    MULTI_FIELDS.reduce((n, f) => n + (((filters[f.key] as string[]) ?? []).length ? 1 : 0), 0) +
    (filters.advanced?.conditions.length ? 1 : 0);
  return (
    <>
      <header
        className="no-print glass sticky top-0 z-40 border-b"
        style={{ background: "var(--topbar)" }}
      >
        <div className="flex flex-wrap items-center gap-2.5 px-5 py-3">
          <div className="mr-auto min-w-0">
            <h1 className="display truncate text-[18px] font-semibold tracking-tight">{title}</h1>
            <p className="text-muted truncate text-[11.5px]">
              {subtitle} ·{" "}
              <span className="num rounded-md px-1 py-px font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                {filteredRows.toLocaleString()}
              </span>{" "}
              of <span className="num">{totalRows.toLocaleString()}</span> leads in view
            </p>
          </div>
          <div className="order-last w-full md:order-none md:w-[260px]">
            <Input
              icon={<Search size={14} />}
              placeholder="Search leads, emails, campaigns…"
              value={filters.search ?? ""}
              onChange={(e) => patch({ search: e.target.value })}
            />
          </div>
          <DateControl />
          <Button variant="outline" onClick={() => setDrawer(true)}>
            <Filter size={14} />
            Filters
            {activeCount > 0 && (
              <span
                className="rounded px-1.5 text-[11px] font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                {activeCount}
              </span>
            )}
          </Button>
          <Button variant="outline" onClick={onRefresh} title={`Last sync: ${fmtDateTime(syncedAt)}`}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden text-[11.5px] lg:inline">{fmtDateTime(syncedAt)}</span>
          </Button>
          <Button variant="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </Button>
        </div>
        <ActiveChips />
      </header>
      <FilterDrawer open={drawer} onClose={() => setDrawer(false)} facets={facets} />
    </>
  );
}
