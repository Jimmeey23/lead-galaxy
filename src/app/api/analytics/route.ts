import { NextResponse } from "next/server";
import { getLeads } from "@/lib/sheet";
import { applyFilters, comparisonRange, resolveRange } from "@/lib/filters";
import {
  buildInsights,
  computeKpis,
  funnelStages,
  groupBy,
  timeSeries,
} from "@/lib/metrics";
import { analyze } from "@/lib/ai";
import { getCadence } from "@/lib/cadence";
import type { FilterState, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

function facets(leads: Lead[]) {
  const uniq = (fn: (l: Lead) => string) =>
    [...new Set(leads.map(fn).filter(Boolean))].sort();
  return {
    center: uniq((l) => l.center),
    associate: uniq((l) => l.associate),
    sourceName: uniq((l) => l.sourceName),
    channel: uniq((l) => l.channel),
    stageName: uniq((l) => l.stageName),
    status: uniq((l) => l.status),
    trialStatus: uniq((l) => l.trialStatus),
    conversionStatus: uniq((l) => l.conversionStatus),
    retentionStatus: uniq((l) => l.retentionStatus),
    classType: uniq((l) => l.classType),
    utmCampaign: uniq((l) => l.utmCampaign),
    utmSource: uniq((l) => l.utmSource),
    utmMedium: uniq((l) => l.utmMedium),
  };
}

function followUpAnalytics(leads: Lead[]) {
  const buckets = [0, 1, 2, 3, 4].map((n) => {
    const rows = leads.filter((l) => l.followUpCount === n);
    const conv = rows.filter((l) => l.converted).length;
    return {
      key: `${n} follow-up${n === 1 ? "" : "s"}`,
      leads: rows.length,
      converted: conv,
      conversionRate: rows.length ? (conv / rows.length) * 100 : 0,
      ltv: rows.reduce((s, l) => s + (l.ltv ?? 0), 0),
    };
  });
  const speed = [
    { key: "Same / next day", test: (d: number) => d <= 1 },
    { key: "2-3 days", test: (d: number) => d >= 2 && d <= 3 },
    { key: "4-7 days", test: (d: number) => d >= 4 && d <= 7 },
    { key: "8-30 days", test: (d: number) => d >= 8 && d <= 30 },
    { key: "30+ days", test: (d: number) => d > 30 },
  ].map((b) => {
    const rows = leads.filter(
      (l) => l.daysToFirstFollowUp != null && l.daysToFirstFollowUp >= 0 && b.test(l.daysToFirstFollowUp),
    );
    const conv = rows.filter((l) => l.converted).length;
    return {
      key: b.key,
      leads: rows.length,
      converted: conv,
      conversionRate: rows.length ? (conv / rows.length) * 100 : 0,
    };
  });
  const needsAttention = leads
    .filter((l) => !l.converted && l.followUpCount < 2)
    .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 50)
    .map((l) => ({
      id: l.id,
      fullName: l.fullName,
      associate: l.associate,
      center: l.center,
      createdAt: l.createdAt,
      followUpCount: l.followUpCount,
      stageName: l.stageName,
      visits: l.visits,
    }));
  const inconsistent = leads.filter((l) =>
    l.issues.some((i) => i.includes("Follow-up")),
  ).length;
  return { buckets, speed, needsAttention, inconsistent };
}

function quality(leads: Lead[]) {
  const checks = [
    { key: "Missing lead ID", test: (l: Lead) => l.issues.includes("Missing lead ID") },
    { key: "Duplicate lead ID", test: (l: Lead) => l.issues.includes("Duplicate lead ID") },
    { key: "Invalid or missing Created At", test: (l: Lead) => !l.createdAt },
    { key: "Missing associate", test: (l: Lead) => l.associate === "Unassigned" },
    { key: "Missing center", test: (l: Lead) => l.center === "Unassigned" },
    { key: "Missing attribution", test: (l: Lead) => !l.utmSource && !l.utmCampaign },
    { key: "No contact details", test: (l: Lead) => !l.phone && !l.email },
    {
      key: "Conflicting lifecycle status",
      test: (l: Lead) =>
        l.issues.some((i) => i.includes("Retained but") || i.includes("Revenue recorded")),
    },
    {
      key: "Converted without date",
      test: (l: Lead) => l.issues.includes("Converted without conversion date"),
    },
    { key: "Invalid numeric values", test: (l: Lead) => (l.ltv ?? 0) < 0 || (l.visits ?? 0) < 0 },
    { key: "Incomplete follow-up record", test: (l: Lead) => l.issues.includes("Follow-up comment without date") },
  ];
  return checks.map((c) => {
    const rows = leads.filter(c.test);
    return {
      key: c.key,
      count: rows.length,
      pct: leads.length ? (rows.length / leads.length) * 100 : 0,
      samples: rows.slice(0, 8).map((l) => ({ id: l.id, fullName: l.fullName })),
    };
  });
}

export async function POST(req: Request) {
 try {
  const body = (await req.json()) as { filters: FilterState; granularity?: "day" | "week" | "month" };
  const f = body.filters;
  const cache = await getLeads();
  if (cache.error && !cache.leads.length)
    return NextResponse.json({ error: cache.error }, { status: 502 });

  const range = resolveRange(f.preset, f.from, f.to);
  const rows = applyFilters(cache.leads, f);
  const kpis = computeKpis(rows);

  const cmpRange = comparisonRange(f.compare ?? "none", range);
  const compare = cmpRange
    ? { range: cmpRange, kpis: computeKpis(applyFilters(cache.leads, f, cmpRange)) }
    : null;

  const g = body.granularity ?? "month";
  const ltvBands = [
    { key: "No LTV", min: -1, max: 0 },
    { key: "₹1 – 10k", min: 0.01, max: 10000 },
    { key: "₹10k – 25k", min: 10000.01, max: 25000 },
    { key: "₹25k – 50k", min: 25000.01, max: 50000 },
    { key: "₹50k – 1L", min: 50000.01, max: 100000 },
    { key: "₹1L+", min: 100000.01, max: Infinity },
  ].map((b) => ({
    key: b.key,
    leads: rows.filter((l) => (l.ltv ?? 0) >= b.min && (l.ltv ?? 0) <= b.max).length,
  }));

  const timeToConv = [
    { key: "0-7 days", lo: 0, hi: 7 },
    { key: "8-30 days", lo: 8, hi: 30 },
    { key: "31-60 days", lo: 31, hi: 60 },
    { key: "61-90 days", lo: 61, hi: 90 },
    { key: "90+ days", lo: 91, hi: Infinity },
  ].map((b) => ({
    key: b.key,
    leads: rows.filter(
      (l) => l.daysToConversion != null && l.daysToConversion >= b.lo && l.daysToConversion <= b.hi,
    ).length,
  }));

  const cadenceConfig = await getCadence();
  const ai = analyze(rows, cadenceConfig);
  return NextResponse.json({
    meta: {
      syncedAt: cache.syncedAt,
      totalRows: cache.leads.length,
      filteredRows: rows.length,
      range,
      error: cache.error,
      crossSheet: cache.crossSheet ?? null,
      cadence: cadenceConfig,
    },
    kpis,
    compare,
    series: timeSeries(rows, g),
    funnel: funnelStages(rows),
    groups: {
      center: groupBy(rows, (l) => l.center),
      associate: groupBy(rows, (l) => l.associate),
      sourceName: groupBy(rows, (l) => l.sourceName),
      sourceId: groupBy(rows, (l) => l.sourceId || "Unknown"),
      channel: groupBy(rows, (l) => l.channel),
      stageName: groupBy(rows, (l) => l.stageName),
      status: groupBy(rows, (l) => l.status),
      classType: groupBy(rows, (l) => l.classType),
      trialStatus: groupBy(rows, (l) => l.trialStatus),
      retentionStatus: groupBy(rows, (l) => l.retentionStatus),
      conversionStatus: groupBy(rows, (l) => l.conversionStatus),
      utmSource: groupBy(rows, (l) => l.utmSource || "(none)"),
      utmMedium: groupBy(rows, (l) => l.utmMedium || "(none)"),
      utmCampaign: groupBy(rows, (l) => l.utmCampaign || "(none)"),
      utmContent: groupBy(rows, (l) => l.utmContent || "(none)"),
      utmTerm: groupBy(rows, (l) => l.utmTerm || "(none)"),
    },
    ltvBands,
    timeToConv,
    followUp: followUpAnalytics(rows),
    quality: quality(rows),
    insights: buildInsights(rows),
    ai,
    facets: facets(cache.leads),
  });
 } catch (e) {
    const msg = (e as Error).message + "\n" + (e as Error).stack;
    console.error("analytics error", msg);
    return NextResponse.json({ error: msg.slice(0,2000) }, { status: 500 });
 }
}
