import type { Lead } from "./types";

export type Kpis = {
  totalLeads: number;
  converted: number;
  conversionRate: number;
  trials: number;
  trialRate: number;
  purchases: number;
  totalLtv: number;
  avgLtvPerLead: number;
  avgLtvPerConverted: number;
  visits: number;
  avgTimeToConversion: number | null;
  followUpCoverage: number;
  retained: number;
  retentionRate: number;
  avgFollowUps: number;
  avgDaysToFirstFollowUp: number | null;
};

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const avg = (a: number[]) => (a.length ? sum(a) / a.length : null);
const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);

export function computeKpis(leads: Lead[]): Kpis {
  const ids = new Set<string>();
  const unique = leads.filter((l) => (ids.has(l.id) ? false : (ids.add(l.id), true)));
  const total = unique.length;
  const conv = unique.filter((l) => l.converted);
  const trials = unique.filter((l) => l.tried);
  const retained = unique.filter((l) => l.retained);
  const ltv = sum(unique.map((l) => l.ltv ?? 0));
  const ttc = conv.map((l) => l.daysToConversion).filter((d): d is number => d != null);
  const fuDelay = unique
    .map((l) => l.daysToFirstFollowUp)
    // exclude implausible gaps (>1 year) which indicate mis-entered sheet dates
    .filter((d): d is number => d != null && d >= 0 && d <= 365);
  return {
    totalLeads: total,
    converted: conv.length,
    conversionRate: pct(conv.length, total),
    trials: trials.length,
    trialRate: pct(trials.length, total),
    purchases: sum(unique.map((l) => l.purchases ?? 0)),
    totalLtv: ltv,
    avgLtvPerLead: total ? ltv / total : 0,
    avgLtvPerConverted: conv.length ? sum(conv.map((l) => l.ltv ?? 0)) / conv.length : 0,
    visits: sum(unique.map((l) => l.visits ?? 0)),
    avgTimeToConversion: avg(ttc),
    followUpCoverage: pct(unique.filter((l) => l.followUpCount > 0).length, total),
    retained: retained.length,
    retentionRate: pct(retained.length, conv.length),
    avgFollowUps: total ? sum(unique.map((l) => l.followUpCount)) / total : 0,
    avgDaysToFirstFollowUp: avg(fuDelay),
  };
}

export type GroupRow = {
  key: string;
  leads: number;
  converted: number;
  conversionRate: number;
  trials: number;
  trialRate: number;
  purchases: number;
  ltv: number;
  avgLtv: number;
  avgLtvPerConverted: number;
  visits: number;
  retained: number;
  retentionRate: number;
  followUpCoverage: number;
  avgTimeToConversion: number | null;
};

export function groupBy(leads: Lead[], keyFn: (l: Lead) => string): GroupRow[] {
  const map = new Map<string, Lead[]>();
  for (const l of leads) {
    const k = keyFn(l) || "Unknown";
    const arr = map.get(k);
    if (arr) arr.push(l);
    else map.set(k, [l]);
  }
  return [...map.entries()]
    .map(([key, rows]) => {
      const k = computeKpis(rows);
      return {
        key,
        leads: k.totalLeads,
        converted: k.converted,
        conversionRate: k.conversionRate,
        trials: k.trials,
        trialRate: k.trialRate,
        purchases: k.purchases,
        ltv: k.totalLtv,
        avgLtv: k.avgLtvPerLead,
        avgLtvPerConverted: k.avgLtvPerConverted,
        visits: k.visits,
        retained: k.retained,
        retentionRate: k.retentionRate,
        followUpCoverage: k.followUpCoverage,
        avgTimeToConversion: k.avgTimeToConversion,
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

export function timeSeries(leads: Lead[], granularity: "day" | "week" | "month") {
  const bucket = (d: string) => {
    if (granularity === "month") return d.slice(0, 7);
    if (granularity === "week") {
      const dt = new Date(d + "T00:00:00Z");
      const day = (dt.getUTCDay() + 6) % 7;
      dt.setUTCDate(dt.getUTCDate() - day);
      return dt.toISOString().slice(0, 10);
    }
    return d;
  };
  const map = new Map<string, { leads: number; converted: number; ltv: number; trials: number }>();
  for (const l of leads) {
    if (!l.createdAt) continue;
    const k = bucket(l.createdAt);
    const e = map.get(k) ?? { leads: 0, converted: 0, ltv: 0, trials: 0 };
    e.leads++;
    if (l.converted) e.converted++;
    if (l.tried) e.trials++;
    e.ltv += l.ltv ?? 0;
    map.set(k, e);
  }
  return [...map.entries()]
    .map(([date, v]) => ({
      date,
      ...v,
      conversionRate: pct(v.converted, v.leads),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function funnelStages(leads: Lead[]) {
  const total = leads.length;
  const contacted = leads.filter(
    (l) => l.followUpCount > 0 || (l.remarks && l.remarks.length > 0),
  ).length;
  const trials = leads.filter((l) => l.tried).length;
  const converted = leads.filter((l) => l.converted).length;
  const purchased = leads.filter((l) => (l.purchases ?? 0) > 0).length;
  const retained = leads.filter((l) => l.retained).length;
  const stages = [
    { stage: "Leads Created", value: total },
    { stage: "Engaged / Followed Up", value: contacted },
    { stage: "Trial Participation", value: trials },
    { stage: "Converted", value: converted },
    { stage: "Purchased", value: purchased },
    { stage: "Retained", value: retained },
  ];
  return stages.map((s, i) => ({
    ...s,
    ofTotal: pct(s.value, total),
    stepRate: i === 0 ? 100 : pct(s.value, stages[i - 1].value),
    dropOff: i === 0 ? 0 : stages[i - 1].value - s.value,
  }));
}

export type Insight = {
  id: string;
  title: string;
  severity: "positive" | "warning" | "critical" | "info";
  evidence: string;
  why: string;
  factors: string;
  action: string;
  monitor: string;
  exploratory: boolean;
  filter?: Record<string, string>;
};

export function buildInsights(leads: Lead[]): Insight[] {
  const out: Insight[] = [];
  const base = computeKpis(leads);
  if (base.totalLeads < 20) return out;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const inr = (n: number) =>
    `₹${Math.round(n).toLocaleString("en-IN")}`;

  const sources = groupBy(leads, (l) => l.sourceName).filter((g) => g.leads >= 20);
  const assoc = groupBy(leads, (l) => l.associate).filter(
    (g) => g.leads >= 20 && g.key !== "Unassigned",
  );
  const centers = groupBy(leads, (l) => l.center).filter((g) => g.leads >= 20);
  const campaigns = groupBy(leads, (l) => l.utmCampaign || "No campaign").filter(
    (g) => g.leads >= 15 && g.key !== "No campaign",
  );

  // 1. High volume, weak conversion source
  const weakSource = [...sources]
    .filter((s) => s.leads >= base.totalLeads * 0.05)
    .sort((a, b) => a.conversionRate - b.conversionRate)[0];
  if (weakSource && weakSource.conversionRate < base.conversionRate * 0.6) {
    out.push({
      id: "weak-source",
      title: `${weakSource.key} delivers volume but converts below benchmark`,
      severity: "warning",
      evidence: `${weakSource.leads.toLocaleString()} leads (${fmtPct(pct(weakSource.leads, base.totalLeads))} of the population) converting at ${fmtPct(weakSource.conversionRate)} versus an overall ${fmtPct(base.conversionRate)}.`,
      why: "A large share of team capacity is absorbed by a channel that returns disproportionately few customers.",
      factors:
        "Possible audience mismatch, broad targeting, weak qualification at intake, or slower first response on this source.",
      action:
        "Review intake qualification and first-response SLA for this source before changing spend or partnership weighting.",
      monitor: "Conversion rate and time-to-first-follow-up for this source over the next 30 days.",
      exploratory: weakSource.leads < 100,
      filter: { sourceName: weakSource.key },
    });
  }
  // 2. Standout associate
  if (assoc.length >= 3) {
    const best = [...assoc].sort((a, b) => b.conversionRate - a.conversionRate)[0];
    if (best.conversionRate > base.conversionRate * 1.25) {
      out.push({
        id: "assoc-top",
        title: `${best.key} converts materially above the team average`,
        severity: "positive",
        evidence: `${best.converted} conversions from ${best.leads} leads (${fmtPct(best.conversionRate)}) against a team average of ${fmtPct(base.conversionRate)}; follow-up coverage ${fmtPct(best.followUpCoverage)}.`,
        why: "Identifying repeatable behaviour from top performers is the cheapest route to lifting overall conversion.",
        factors:
          "Could reflect genuine skill, but also lead-mix advantages (source quality, centre, or class type) — verify before generalising.",
        action:
          "Audit this associate's follow-up cadence and scripts, then pilot them with two mid-performing associates.",
        monitor: "Conversion rate of the pilot group versus control over the next two months.",
        exploratory: best.leads < 80,
        filter: { associate: best.key },
      });
    }
    const worst = [...assoc].sort((a, b) => a.conversionRate - b.conversionRate)[0];
    if (worst.conversionRate < base.conversionRate * 0.6 && worst.leads >= 40) {
      out.push({
        id: "assoc-low",
        title: `${worst.key} is converting well below peers on a meaningful lead volume`,
        severity: "critical",
        evidence: `${worst.converted}/${worst.leads} converted (${fmtPct(worst.conversionRate)}); follow-up coverage ${fmtPct(worst.followUpCoverage)} versus ${fmtPct(base.followUpCoverage)} overall.`,
        why: "At this volume the gap represents a quantifiable number of missed customers each month.",
        factors:
          "Check lead source mix and centre allocation before attributing to performance; coverage gaps often explain most of the difference.",
        action: "Run a joint pipeline review on open leads and rebalance allocation if the source mix is unfavourable.",
        monitor: "Weekly follow-up coverage and conversion for this associate.",
        exploratory: false,
        filter: { associate: worst.key },
      });
    }
  }
  // 3. Follow-up coverage gap
  const noFu = leads.filter((l) => l.followUpCount === 0);
  if (noFu.length) {
    const withFu = leads.filter((l) => l.followUpCount > 0);
    const crNo = pct(noFu.filter((l) => l.converted).length, noFu.length);
    const crYes = pct(withFu.filter((l) => l.converted).length, withFu.length || 1);
    out.push({
      id: "fu-gap",
      title: `${noFu.length.toLocaleString()} leads have no recorded follow-up`,
      severity: crYes > crNo ? "critical" : "info",
      evidence: `Leads with at least one recorded follow-up convert at ${fmtPct(crYes)} versus ${fmtPct(crNo)} for leads with none (${fmtPct(pct(noFu.length, base.totalLeads))} of the population).`,
      why: "Recorded follow-up is the strongest controllable variable visible in this dataset.",
      factors:
        "This may partly reflect recording discipline rather than genuine inactivity — the sheet stores dates, not confirmed contact.",
      action: "Close the recording gap first, then set a 48-hour first-touch rule for all new leads.",
      monitor: "Follow-up coverage percentage and days-to-first-follow-up weekly.",
      exploratory: true,
      filter: { followUpActivity: "none" },
    });
  }
  // 4. Engaged but unconverted
  const engaged = leads.filter((l) => !l.converted && ((l.visits ?? 0) > 0 || l.tried));
  if (engaged.length >= 10) {
    out.push({
      id: "engaged-unconverted",
      title: `${engaged.length.toLocaleString()} engaged leads have not converted`,
      severity: "warning",
      evidence: `These leads recorded a trial or at least one visit yet remain unconverted; they represent ${fmtPct(pct(engaged.length, base.totalLeads))} of the filtered population.`,
      why: "Trial attendance is the highest-intent signal available; these are the warmest reactivation targets.",
      factors: "Pricing objections, scheduling friction, or absent post-trial follow-up.",
      action: "Build a post-trial reactivation list and assign it to the highest-converting associates.",
      monitor: "Conversion rate of this cohort over the next 30 days.",
      exploratory: false,
      filter: { followUpActivity: "any" },
    });
  }
  // 5. Campaign with high value per lead
  if (campaigns.length >= 2) {
    const byValue = [...campaigns].sort((a, b) => b.avgLtv - a.avgLtv);
    const top = byValue[0];
    if (top.avgLtv > base.avgLtvPerLead * 1.4) {
      out.push({
        id: "campaign-value",
        title: `Campaign "${top.key}" produces above-average value per lead`,
        severity: "positive",
        evidence: `${inr(top.avgLtv)} average LTV per lead across ${top.leads} leads versus ${inr(base.avgLtvPerLead)} overall; conversion ${fmtPct(top.conversionRate)}.`,
        why: "Value per lead, not lead count, determines commercial return from campaign effort.",
        factors: "Attribution is last-touch from UTM tags; some value may be mis-attributed.",
        action:
          "Expand creative and audience variants of this campaign while monitoring value per lead for dilution.",
        monitor: "Average LTV per lead for this campaign as volume scales.",
        exploratory: top.leads < 50,
        filter: { utmCampaign: top.key },
      });
    }
  }
  // 6. Centre quality variance
  if (centers.length >= 2) {
    const sorted = [...centers].sort((a, b) => b.conversionRate - a.conversionRate);
    const hi = sorted[0];
    const lo = sorted[sorted.length - 1];
    if (hi.conversionRate - lo.conversionRate > 8) {
      out.push({
        id: "center-gap",
        title: `${Math.round(hi.conversionRate - lo.conversionRate)} point conversion gap between ${hi.key} and ${lo.key}`,
        severity: "warning",
        evidence: `${hi.key}: ${fmtPct(hi.conversionRate)} from ${hi.leads} leads. ${lo.key}: ${fmtPct(lo.conversionRate)} from ${lo.leads} leads.`,
        why: "Persistent studio-level gaps usually indicate process rather than market differences.",
        factors: "Source mix, staffing levels, trial scheduling availability and local demand all contribute.",
        action: "Compare source mix side by side in Centre Performance before any staffing decisions.",
        monitor: "Monthly conversion rate by centre, normalised for source mix.",
        exploratory: false,
        filter: { center: lo.key },
      });
    }
  }
  // 7. Retention by source
  const retSources = sources.filter((s) => s.converted >= 5);
  if (retSources.length >= 2) {
    const best = [...retSources].sort((a, b) => b.retentionRate - a.retentionRate)[0];
    out.push({
      id: "retention-source",
      title: `${best.key} delivers the strongest retention among converted leads`,
      severity: "positive",
      evidence: `${best.retained}/${best.converted} converted leads retained (${fmtPct(best.retentionRate)}), with ${inr(best.avgLtvPerConverted)} average LTV per converted lead.`,
      why: "Retention compounds lifetime value far more than incremental acquisition volume.",
      factors: "Referral and word-of-mouth channels typically arrive pre-qualified and better matched.",
      action: "Shift acquisition emphasis and referral incentives toward this channel.",
      monitor: "Retention rate and LTV per converted lead by source each quarter.",
      exploratory: best.converted < 20,
      filter: { sourceName: best.key },
    });
  }
  // 8. Data quality
  const flagged = leads.filter((l) => l.issues.length > 0);
  if (flagged.length > base.totalLeads * 0.05) {
    out.push({
      id: "data-quality",
      title: `${flagged.length.toLocaleString()} records carry at least one data-quality flag`,
      severity: "warning",
      evidence: `${fmtPct(pct(flagged.length, base.totalLeads))} of the filtered population has missing ownership, attribution, invalid dates, duplicates or contradictory lifecycle values.`,
      why: "Metric reliability degrades directly with input quality; some KPIs may understate reality.",
      factors: "Manual entry, incomplete CRM sync, and placeholder characters used in place of blanks.",
      action: "Work the Data Quality module queue, starting with missing ownership and duplicate IDs.",
      monitor: "Flagged-record percentage week on week.",
      exploratory: false,
    });
  }
  // 9. Slow follow-up correlation
  const fast = leads.filter((l) => (l.daysToFirstFollowUp ?? -1) >= 0 && l.daysToFirstFollowUp! <= 2);
  const slow = leads.filter((l) => (l.daysToFirstFollowUp ?? -1) > 7);
  if (fast.length >= 20 && slow.length >= 20) {
    const crF = pct(fast.filter((l) => l.converted).length, fast.length);
    const crS = pct(slow.filter((l) => l.converted).length, slow.length);
    if (Math.abs(crF - crS) > 3) {
      out.push({
        id: "speed",
        title:
          crF > crS
            ? "Fast first follow-up is associated with higher conversion"
            : "Follow-up speed shows no conversion advantage in this period",
        severity: crF > crS ? "info" : "info",
        evidence: `Within 2 days: ${fmtPct(crF)} conversion (${fast.length} leads). After 7 days: ${fmtPct(crS)} (${slow.length} leads).`,
        why: "Speed to first contact is operationally controllable and cheap to improve.",
        factors:
          "Association is not causation — high-intent leads are often contacted faster, which inflates the effect.",
        action: "Set and instrument a 48-hour first-contact SLA; review exceptions weekly.",
        monitor: "Share of leads with first follow-up within 48 hours.",
        exploratory: true,
      });
    }
  }
  return out;
}
