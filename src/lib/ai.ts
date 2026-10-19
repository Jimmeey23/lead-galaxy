import type { Lead } from "./types";
import { dayDiff } from "./sheet";
import { DEFAULT_CADENCE, type CadenceConfig } from "./cadence-config";

/* AI Cadence rules (configurable in Settings): FU1 within N days of creation, FU2-4 relative to the previous follow-up. */
export const CADENCE = [
  { idx: 0, label: "FU1" },
  { idx: 1, label: "FU2" },
  { idx: 2, label: "FU3" },
  { idx: 3, label: "FU4" },
];

const gapsOf = (c: CadenceConfig) => [c.fu1FromCreate, c.fu2Gap, c.fu3Gap, c.fu4Gap];

export type CadenceStatus = "on-track" | "due-today" | "overdue" | "missed" | "complete" | "not-started";

export function cadenceForLead(lead: Lead, today = todayISO(), config: CadenceConfig = DEFAULT_CADENCE): {
  status: CadenceStatus;
  nextDue: string | null;
  overdueBy: number | null;
  nextAction: string;
  riskScore: number;
  opportunityScore: number;
  flags: string[];
  expected: { label: string; expectedDate: string | null; actual: string | null; state: "done" | "overdue" | "due" | "upcoming" | "skipped" }[];
} {
  const flags: string[] = [];
  const expected: { label: string; expectedDate: string | null; actual: string | null; state: "done" | "overdue" | "due" | "upcoming" | "skipped" }[] = [];
  if (!lead.createdAt) {
    return {
      status: "not-started",
      nextDue: null,
      overdueBy: null,
      nextAction: "Missing creation date — cannot evaluate cadence",
      riskScore: 50,
      opportunityScore: 50,
      flags: ["Missing Created At"],
      expected,
    };
  }
  const fu = lead.followUps;
  const gaps = gapsOf(config);
  // build Expected dates
  let prevDate: string | null = lead.createdAt;
  for (let i = 0; i < 4; i++) {
    const c = CADENCE[i];
    let expectedDate: string | null = null;
    if (i === 0) expectedDate = addDays(lead.createdAt, gaps[0]);
    else if (prevDate) expectedDate = addDays(prevDate, gaps[i]);
    const actual = fu[i]?.date ?? null;

    let state: "done" | "overdue" | "due" | "upcoming" | "skipped" = "upcoming";
    if (actual) {
      state = "done";
      // check lateness
      if (expectedDate && actual > expectedDate) flags.push(`${c.label} was late (${actual} vs expected ${expectedDate})`);
      prevDate = actual;
    } else {
      // not done, check if overdue
      if (expectedDate) {
        if (expectedDate < today) state = "overdue";
        else if (expectedDate === today) state = "due";
        else state = "upcoming";
      }
      // if previous was skipped, this one is also skipped in sense
      if (!prevDate && state !== "overdue") state = "skipped";
      // don't advance prevDate on missed
    }
    expected.push({ label: c.label, expectedDate, actual, state });
  }

  const overdue = expected.filter((e) => e.state === "overdue");
  const done = expected.filter((e) => e.state === "done").length;

  let status: CadenceStatus = "on-track";
  let nextDue: string | null = null;
  let overdueBy: number | null = null;

  if (done === 4) status = "complete";
  else if (overdue.length) {
    const first = overdue[0];
    status = overdue.length >= config.missedThreshold ? "missed" : "overdue";
    nextDue = first.expectedDate;
    overdueBy = first.expectedDate ? dayDiff(first.expectedDate, today) : null;
  } else if (expected.some((e) => e.state === "due")) {
    status = "due-today";
    nextDue = expected.find((e) => e.state === "due")!.expectedDate;
  } else if (done === 0 && lead.followUpCount === 0) status = "not-started";
  else status = "on-track";

  // risk & opportunity scoring
  let riskScore = 0;
  let opportunityScore = 50;

  // risk increases with overdue, no follow-up, high visits but not converted
  if (status === "missed") riskScore += 45;
  else if (status === "overdue") riskScore += 30;
  if (lead.followUpCount === 0) riskScore += 20;
  if (lead.createdAt && dayDiff(lead.createdAt, today) > 21 && !lead.converted) riskScore += 15;
  if ((lead.visits ?? 0) > 2 && !lead.converted) riskScore += 10;

  // opportunity: visits, trial, recent creation, high LTV
  if ((lead.visits ?? 0) > 0) opportunityScore += 20;
  if (lead.tried) opportunityScore += 15;
  if ((lead.ltv ?? 0) > 50000) opportunityScore += 20;
  if (lead.createdAt && dayDiff(lead.createdAt, today) <= 14) opportunityScore += 10;
  if (lead.followUpCount === 0 && !lead.converted) opportunityScore += 10; // easy win

  riskScore = Math.min(100, Math.max(0, riskScore));
  opportunityScore = Math.min(100, Math.max(0, opportunityScore));

  let nextAction = "";
  if (lead.converted) nextAction = "Converted — nurture for retention & referral";
  else if (status === "complete") nextAction = "Cadence exhausted — send re-engagement or close as lost";
  else if (status === "missed" || status === "overdue") nextAction = `Complete ${overdue[0]?.label} immediately — overdue by ${overdueBy ?? "?"}d`;
  else if (status === "due-today") nextAction = `Do ${expected.find((e) => e.state === "due")?.label} today`;
  else if (status === "not-started") nextAction = "Start FU1 — within 24h is optimal";
  else nextAction = `Schedule ${expected.find((e) => e.state === "upcoming")?.label || "next FU"}`;

  // additional anomaly flags
  if (lead.converted && (lead.purchases ?? 0) === 0) flags.push("Marked converted but no purchase found in Sales sheet");
  if (lead.conversionStatus === "Unverified") flags.push("Conversion unverified — Sales source unavailable");
  if (lead.converted && (lead.visits ?? 0) === 0) flags.push("Converted without any recorded visit");
  if ((lead.visits ?? 0) > 10 && !lead.converted) flags.push("High visit count but unconverted — investigate");
  if (lead.daysToConversion != null && lead.daysToConversion < 0) flags.push("Conversion precedes creation — data error");
  if (!lead.associate || lead.associate === "Unassigned") flags.push("Unassigned — follow-up responsibility unclear");
  if (lead.followUps.some((f, i) => f.date && fu[i - 1] && !fu[i - 1].date)) flags.push("FU gap — later FU recorded without earlier FU");
  if (lead.daysToFirstFollowUp != null && lead.daysToFirstFollowUp < 0) flags.push("Follow-up precedes creation — clock error");

  return { status, nextDue, overdueBy, nextAction, riskScore, opportunityScore, flags, expected };
}

function todayISO() {
  const d = new Date();
  // IST midnight
  const ist = new Date(d.getTime() + 330 * 60000);
  return ist.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  try {
    const d = new Date(iso + "T00:00:00Z");
    if (isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}

/* -------------- aggregate AI analysis for a filtered population -------------- */
export type AILeadRow = ReturnType<typeof cadenceForLead> & { id: string; fullName: string; associate: string; center: string; createdAt: string | null; stageName: string };

export type AIAnalysis = {
  summary: {
    total: number;
    overdue: number;
    missed: number;
    dueToday: number;
    notStarted: number;
    complete: number;
    onTrack: number;
    avgRisk: number;
    avgOpportunity: number;
    discrepancyCount: number;
    anomalyCount: number;
  };
  missedFollowups: AILeadRow[];
  missedOpportunities: AILeadRow[];
  discrepancies: (AILeadRow & { discrepancy: string })[];
  anomalies: (AILeadRow & { anomaly: string })[];
  cadenceBreakdown: { label: string; done: number; overdue: number; due: number; upcoming: number }[];
  riskByAssociate: { key: string; avgRisk: number; overdue: number; leads: number }[];
  riskByCenter: { key: string; avgRisk: number; overdue: number; leads: number }[];
  recommendations: { title: string; description: string; priority: "high" | "medium" | "low"; leads: number; action: string }[];
};

export function analyze(leads: Lead[], config: CadenceConfig = DEFAULT_CADENCE): AIAnalysis {
  const today = todayISO();
  const rows: AILeadRow[] = leads.map((l) => {
    try {
      const c = cadenceForLead(l, today, config);
      return { id: l.id, fullName: l.fullName, associate: l.associate, center: l.center, createdAt: l.createdAt, stageName: l.stageName, ...c };
    } catch {
      return { id: l.id, fullName: l.fullName, associate: l.associate, center: l.center, createdAt: l.createdAt, stageName: l.stageName, status: "not-started" as CadenceStatus, nextDue: null, overdueBy: null, nextAction: "Cadence unavailable", riskScore: 50, opportunityScore: 50, flags: ["Cadence calc error"], expected: [] };
    }
  });
  const overdue = rows.filter((r) => r.status === "overdue").length;
  const missed = rows.filter((r) => r.status === "missed").length;
  const dueToday = rows.filter((r) => r.status === "due-today").length;
  const notStarted = rows.filter((r) => r.status === "not-started").length;
  const complete = rows.filter((r) => r.status === "complete").length;
  const onTrack = rows.filter((r) => r.status === "on-track").length;
  const avgRisk = rows.length ? rows.reduce((s, r) => s + r.riskScore, 0) / rows.length : 0;
  const avgOpportunity = rows.length ? rows.reduce((s, r) => s + r.opportunityScore, 0) / rows.length : 0;

  const missedFollowups = [...rows]
    .filter((r) => r.status === "overdue" || r.status === "missed")
    .sort((a, b) => (b.overdueBy ?? 0) - (a.overdueBy ?? 0))
    .slice(0, 100);

  const missedOpportunities = [...rows]
    .filter((r) => !leads.find((l) => l.id === r.id)?.converted && r.opportunityScore >= 70)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 100);

  const discrepancies: (AILeadRow & { discrepancy: string })[] = [];
  const anomalies: (AILeadRow & { anomaly: string })[] = [];
  for (const r of rows) {
    const l = leads.find((x) => x.id === r.id)!;
    if (r.flags.some((f) => f.includes("Marked converted") || f.includes("Has purchase"))) {
      discrepancies.push({ ...r, discrepancy: r.flags.find((f) => f.includes("Marked") || f.includes("Has purchase"))! });
    }
    if (r.flags.some((f) => f.includes("Converted without") || f.includes("High visit"))) {
      anomalies.push({ ...r, anomaly: r.flags.find((f) => f.includes("Converted without") || f.includes("High visit"))! });
    }
  }

  const cadenceBreakdown = CADENCE.map((c) => {
    let done = 0, overdueCount = 0, due = 0, upcoming = 0;
    for (const r of rows) {
      const e = r.expected[c.idx];
      if (!e) continue;
      if (e.state === "done") done++;
      else if (e.state === "overdue") overdueCount++;
      else if (e.state === "due") due++;
      else upcoming++;
    }
    return { label: c.label, done, overdue: overdueCount, due, upcoming };
  });

  const groupRisk = (key: (r: AILeadRow) => string) => {
    const m = new Map<string, AILeadRow[]>();
    for (const r of rows) {
      const k = key(r) || "Unknown";
      const arr = m.get(k);
      if (arr) arr.push(r);
      else m.set(k, [r]);
    }
    return [...m.entries()]
      .map(([k, arr]) => ({
        key: k,
        avgRisk: arr.reduce((s, x) => s + x.riskScore, 0) / arr.length,
        overdue: arr.filter((x) => x.status === "overdue" || x.status === "missed").length,
        leads: arr.length,
      }))
      .sort((a, b) => b.avgRisk - a.avgRisk);
  };

  const recommendations: AIAnalysis["recommendations"] = [];
  if (missedFollowups.length > leads.length * 0.1) {
    recommendations.push({
      title: "Restore follow-up cadence discipline",
      description: `${missedFollowups.length} leads are overdue or have missed the cadence — more than 10% of the active population.`,
      priority: "high",
      leads: missedFollowups.length,
      action: "Re-assign overdue FU1s due-today first, then clear the missed backlog by centre.",
    });
  }
  if (missedOpportunities.length > 20) {
    recommendations.push({
      title: "Re-activate high-intent, unconverted leads",
      description: `${missedOpportunities.length} unconverted leads show strong engagement signals (visits/trial) and high opportunity scores.`,
      priority: "high",
      leads: missedOpportunities.length,
      action: "Create a same-week re-engagement sprint for this cohort with your top converters.",
    });
  }
  if (discrepancies.length > 50) {
    recommendations.push({
      title: "Resolve Sales-sheet discrepancies",
      description: `${discrepancies.length} records have conflicting conversion semantics between the lead sheet and Sales truth.`,
      priority: "medium",
      leads: discrepancies.length,
      action: "Use Data Quality to triage — sales truth should govern conversion reporting.",
    });
  }
  if (notStarted > leads.length * 0.15) {
    recommendations.push({
      title: "Close the intake gap",
      description: `${notStarted} leads have never received a recorded follow-up.`,
      priority: "high",
      leads: notStarted,
      action: "Enforce a 24-hour FU1 SLA at intake; audit new lead assignment.",
    });
  }
  if (!recommendations.length) {
    recommendations.push({
      title: "Maintain current discipline",
      description: "No systemic breakdown detected — continue monitoring cadence adherence weekly.",
      priority: "low",
      leads: 0,
      action: "Review the cadence breakdown to stay ahead of due-today follow-ups.",
    });
  }

  return {
    summary: {
      total: rows.length,
      overdue,
      missed,
      dueToday,
      notStarted,
      complete,
      onTrack,
      avgRisk,
      avgOpportunity,
      discrepancyCount: discrepancies.length,
      anomalyCount: anomalies.length,
    },
    missedFollowups,
    missedOpportunities,
    discrepancies,
    anomalies,
    cadenceBreakdown,
    riskByAssociate: groupRisk((r) => r.associate).slice(0, 12),
    riskByCenter: groupRisk((r) => r.center).slice(0, 12),
    recommendations,
  };
}
