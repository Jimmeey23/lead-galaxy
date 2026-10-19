import type { AdvGroup, FilterState, Lead } from "./types";

/* Reporting timezone: Asia/Kolkata (UTC+5:30) */
const TZ_OFFSET_MIN = 330;

export function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + TZ_OFFSET_MIN * 60000);
  return ist.toISOString().slice(0, 10);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T00:00:00Z");
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

export const DATE_PRESETS = [
  "Today",
  "Yesterday",
  "Last 7 Days",
  "Last 14 Days",
  "Last 30 Days",
  "This Week",
  "Last Week",
  "This Month",
  "Last Month",
  "This Quarter",
  "Last Quarter",
  "This Year",
  "Last Year",
  "All Time",
  "Custom Range",
] as const;

export function resolveRange(
  preset: string,
  from?: string | null,
  to?: string | null,
): { from: string | null; to: string | null } {
  const t = todayIST();
  const d = parse(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const startOfWeek = (ref: Date) => {
    const x = new Date(ref);
    const day = (x.getUTCDay() + 6) % 7; // Monday start
    x.setUTCDate(x.getUTCDate() - day);
    return iso(x);
  };
  switch (preset) {
    case "Today":
      return { from: t, to: t };
    case "Yesterday":
      return { from: addDays(t, -1), to: addDays(t, -1) };
    case "Last 7 Days":
      return { from: addDays(t, -6), to: t };
    case "Last 14 Days":
      return { from: addDays(t, -13), to: t };
    case "Last 30 Days":
      return { from: addDays(t, -29), to: t };
    case "This Week":
      return { from: startOfWeek(d), to: t };
    case "Last Week": {
      const s = addDays(startOfWeek(d), -7);
      return { from: s, to: addDays(s, 6) };
    }
    case "This Month":
      return { from: iso(new Date(Date.UTC(y, m, 1))), to: t };
    case "Last Month":
      return {
        from: iso(new Date(Date.UTC(y, m - 1, 1))),
        to: iso(new Date(Date.UTC(y, m, 0))),
      };
    case "This Quarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: iso(new Date(Date.UTC(y, q, 1))), to: t };
    }
    case "Last Quarter": {
      const q = Math.floor(m / 3) * 3 - 3;
      return {
        from: iso(new Date(Date.UTC(y, q, 1))),
        to: iso(new Date(Date.UTC(y, q + 3, 0))),
      };
    }
    case "This Year":
      return { from: iso(new Date(Date.UTC(y, 0, 1))), to: t };
    case "Last Year":
      return {
        from: iso(new Date(Date.UTC(y - 1, 0, 1))),
        to: iso(new Date(Date.UTC(y - 1, 11, 31))),
      };
    case "Custom Range":
      return { from: from || null, to: to || null };
    default:
      return { from: null, to: null };
  }
}

export function comparisonRange(
  mode: string,
  range: { from: string | null; to: string | null },
): { from: string | null; to: string | null } | null {
  if (!mode || mode === "none" || !range.from || !range.to) return null;
  const span = (parse(range.to).getTime() - parse(range.from).getTime()) / 86400000 + 1;
  if (mode === "previous")
    return { from: addDays(range.from, -span), to: addDays(range.to, -span) };
  const shift = (months: number) => {
    const f = parse(range.from!);
    const t = parse(range.to!);
    f.setUTCMonth(f.getUTCMonth() - months);
    t.setUTCMonth(t.getUTCMonth() - months);
    return { from: iso(f), to: iso(t) };
  };
  if (mode === "lastMonth") return shift(1);
  if (mode === "lastYear") return shift(12);
  return null;
}

function leadDate(l: Lead, dim: FilterState["dateDimension"]): string | null {
  if (dim === "convertedAt") return l.convertedAt;
  if (dim === "followUp") return l.firstFollowUp;
  return l.createdAt;
}

const inSet = (sel: string[] | undefined, v: string) => !sel?.length || sel.includes(v);

function fieldValue(l: Lead, field: string): string | number | null {
  switch (field) {
    case "center":
      return l.center;
    case "associate":
      return l.associate;
    case "sourceName":
      return l.sourceName;
    case "channel":
      return l.channel;
    case "stageName":
      return l.stageName;
    case "status":
      return l.status;
    case "trialStatus":
      return l.trialStatus;
    case "conversionStatus":
      return l.conversionStatus;
    case "retentionStatus":
      return l.retentionStatus;
    case "classType":
      return l.classType;
    case "utmCampaign":
      return l.utmCampaign;
    case "utmSource":
      return l.utmSource;
    case "utmMedium":
      return l.utmMedium;
    case "fullName":
      return l.fullName;
    case "email":
      return l.email;
    case "phone":
      return l.phone;
    case "remarks":
      return l.remarks;
    case "ltv":
      return l.ltv;
    case "visits":
      return l.visits;
    case "purchases":
      return l.purchases;
    case "followUpCount":
      return l.followUpCount;
    default:
      return null;
  }
}

function evalAdvanced(l: Lead, g: AdvGroup): boolean {
  if (!g.conditions.length) return true;
  const results = g.conditions.map((c) => {
    const v = fieldValue(l, c.field);
    const s = String(v ?? "").toLowerCase();
    const target = c.value.toLowerCase();
    const n = typeof v === "number" ? v : Number(v);
    switch (c.op) {
      case "is":
        return s === target;
      case "isNot":
        return s !== target;
      case "contains":
        return s.includes(target);
      case "notContains":
        return !s.includes(target);
      case "empty":
        return v == null || s === "" || s === "unknown";
      case "notEmpty":
        return !(v == null || s === "" || s === "unknown");
      case "gt":
        return Number.isFinite(n) && n > Number(c.value);
      case "lt":
        return Number.isFinite(n) && n < Number(c.value);
      case "gte":
        return Number.isFinite(n) && n >= Number(c.value);
      case "lte":
        return Number.isFinite(n) && n <= Number(c.value);
      default:
        return true;
    }
  });
  return g.combinator === "OR" ? results.some(Boolean) : results.every(Boolean);
}

export function applyFilters(
  leads: Lead[],
  f: FilterState,
  overrideRange?: { from: string | null; to: string | null },
): Lead[] {
  const range = overrideRange ?? resolveRange(f.preset, f.from, f.to);
  const q = (f.search || "").trim().toLowerCase();
  return leads.filter((l) => {
    if (range.from || range.to) {
      const d = leadDate(l, f.dateDimension);
      if (!d) return false;
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
    }
    if (!inSet(f.center, l.center)) return false;
    if (!inSet(f.associate, l.associate)) return false;
    if (!inSet(f.sourceName, l.sourceName)) return false;
    if (!inSet(f.channel, l.channel)) return false;
    if (!inSet(f.stageName, l.stageName)) return false;
    if (!inSet(f.status, l.status)) return false;
    if (!inSet(f.trialStatus, l.trialStatus)) return false;
    if (!inSet(f.conversionStatus, l.conversionStatus)) return false;
    if (!inSet(f.retentionStatus, l.retentionStatus)) return false;
    if (!inSet(f.classType, l.classType)) return false;
    if (!inSet(f.utmCampaign, l.utmCampaign)) return false;
    if (!inSet(f.utmSource, l.utmSource)) return false;
    if (!inSet(f.utmMedium, l.utmMedium)) return false;
    if (f.ltvMin != null && (l.ltv ?? 0) < f.ltvMin) return false;
    if (f.ltvMax != null && (l.ltv ?? 0) > f.ltvMax) return false;
    if (f.visitsMin != null && (l.visits ?? 0) < f.visitsMin) return false;
    if (f.visitsMax != null && (l.visits ?? 0) > f.visitsMax) return false;
    if (f.purchasesMin != null && (l.purchases ?? 0) < f.purchasesMin) return false;
    if (f.followUpActivity && f.followUpActivity !== "any") {
      if (f.followUpActivity === "none" && l.followUpCount > 0) return false;
      if (f.followUpActivity === "withFollowUps" && l.followUpCount === 0) return false;
      const n = Number(f.followUpActivity);
      if (Number.isFinite(n) && l.followUpCount !== n) return false;
    }
    if (q) {
      const hay = `${l.id} ${l.fullName} ${l.phone} ${l.email} ${l.associate} ${l.center} ${l.sourceName} ${l.utmCampaign} ${l.stageName} ${l.remarks} ${l.memberId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.advanced && f.advanced.conditions.length && !evalAdvanced(l, f.advanced))
      return false;
    return true;
  });
}

export function parseFilters(sp: URLSearchParams): FilterState {
  const raw = sp.get("f");
  if (raw) {
    try {
      return JSON.parse(raw) as FilterState;
    } catch {
      /* ignore */
    }
  }
  return { dateDimension: "createdAt", preset: "All Time" };
}
