import { firstConversionSale, CONVERSION_RULE_VERSION, isWonStage } from "./conversion";
import { resolveMomenceHost } from "./momence-host";
import type { Lead } from "./types";

const SHEET_ID =
  process.env.SHEET_ID || "1dQMNF69WnXVQdhlLvUZTig3kL97NA21k6eZ9HRu6xiQ";
const GID = process.env.SHEET_GID || "256104486";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${GID}`;

/* ------------------------------ CSV parsing ------------------------------ */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      /* skip */
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/* ----------------------------- Normalisation ----------------------------- */
const MISSING = new Set(["", "-", "--", "n/a", "na", "null", "undefined", "#n/a"]);

export function cleanStr(v: string | undefined): string {
  if (v == null) return "";
  const t = v.trim();
  if (MISSING.has(t.toLowerCase())) return "";
  return t;
}

export function cleanNum(v: string | undefined): number | null {
  const s = cleanStr(v);
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.\-]/g, "").replace(/\.$/, "") || "0");
  return Number.isFinite(n) ? n : null;
}

export function cleanDate(v: string | undefined): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) {
    const y = Number(m[1]);
    if (y < 1970 || y > 2100) return null;
    const mm = Number(m[2]); const dd = Number(m[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const yn = Number(y);
    if (yn < 1970 || yn > 2100) return null;
    const mm = Number(m[2]); const dd = Number(m[1]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const iso = d.toISOString().slice(0, 10);
    const yn = Number(iso.slice(0,4));
    if (yn < 1970 || yn > 2100) return null;
    return iso;
  }
  return null;
}
const pad = (s: string) => s.padStart(2, "0");

export const dayDiff = (a: string, b: string) => {
  try {
    const da = new Date(a + "T00:00:00Z");
    const db = new Date(b + "T00:00:00Z");
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  } catch { return 0; }
};

function col(headers: string[], name: string) {
  const i = headers.findIndex(
    (h) => h.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  return i;
}

export function normalise(rows: string[][]): { leads: Lead[]; headers: string[] } {
  if (!rows.length) return { leads: [], headers: [] };
  const headers = rows[0].map((h) => h.trim());
  const idx = (n: string) => col(headers, n);
  const I = {
    id: idx("ID"),
    name: idx("Full Name"),
    phone: idx("Phone Number"),
    email: idx("Email"),
    created: idx("Created At"),
    sourceId: idx("Source ID"),
    sourceName: idx("Source Name"),
    memberId: idx("Member ID"),
    converted: idx("Converted To Customer At"),
    stage: idx("Stage Name"),
    associate: idx("Associate"),
    remarks: idx("Remarks"),
    fu1d: idx("Follow Up 1 Date"),
    fu1c: idx("Follow Up Comments (1)"),
    fu2d: idx("Follow Up 2 Date"),
    fu2c: idx("Follow Up Comments (2)"),
    fu3d: idx("Follow Up 3 Date"),
    fu3c: idx("Follow Up Comments (3)"),
    fu4d: idx("Follow Up 4 Date"),
    fu4c: idx("Follow Up Comments (4)"),
    center: idx("Center"),
    classType: idx("Class Type"),
    hostId: idx("Host ID"),
    status: idx("Status"),
    channel: idx("Channel"),
    period: idx("Period"),
    us: idx("UTM Source"),
    um: idx("UTM Medium"),
    uc: idx("UTM Campaign"),
    ut: idx("UTM Term"),
    ucon: idx("UTM Content"),
    purchases: idx("Purchases Made"),
    ltv: idx("LTV"),
    visits: idx("Visits"),
    trial: idx("Trial Status"),
    conv: idx("Conversion Status"),
    ret: idx("Retention Status"),
  };
  const get = (r: string[], i: number) => (i >= 0 ? r[i] : "");
  const seen = new Map<string, number>();
  const leads: Lead[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !c || !c.trim())) continue;
    const id = cleanStr(get(row, I.id));
    const createdAt = cleanDate(get(row, I.created));
    const convertedAt = cleanDate(get(row, I.converted));
    const followUps = [
      { date: cleanDate(get(row, I.fu1d)), comment: cleanStr(get(row, I.fu1c)) },
      { date: cleanDate(get(row, I.fu2d)), comment: cleanStr(get(row, I.fu2c)) },
      { date: cleanDate(get(row, I.fu3d)), comment: cleanStr(get(row, I.fu3c)) },
      { date: cleanDate(get(row, I.fu4d)), comment: cleanStr(get(row, I.fu4c)) },
    ];
    const conversionStatus = cleanStr(get(row, I.conv));
    const trialStatus = cleanStr(get(row, I.trial));
    const retentionStatus = cleanStr(get(row, I.ret));
    const recorded = followUps.filter((f) => f.date || f.comment);
    const fuDates = followUps
      .map((f) => f.date)
      .filter((d): d is string => !!d)
      .sort();
    const firstFollowUp = fuDates[0] ?? null;
    const ltv = cleanNum(get(row, I.ltv));
    const visits = cleanNum(get(row, I.visits));
    const purchases = cleanNum(get(row, I.purchases));
    const issues: string[] = [];
    if (!id) issues.push("Missing lead ID");
    if (!createdAt) issues.push("Invalid or missing Created At");
    if (!cleanStr(get(row, I.associate))) issues.push("Missing associate");
    if (!cleanStr(get(row, I.center))) issues.push("Missing center");
    if (!cleanStr(get(row, I.sourceName))) issues.push("Missing source");
    if (!cleanStr(get(row, I.phone)) && !cleanStr(get(row, I.email)))
      issues.push("No contact details");
    if (createdAt && convertedAt && dayDiff(createdAt, convertedAt) < 0)
      issues.push("Conversion date precedes creation date");
    if (followUps.some((f) => f.comment && !f.date)) issues.push("Follow-up comment without date");
    if ([get(row, I.fu1d), get(row, I.fu2d), get(row, I.fu3d), get(row, I.fu4d)].some((raw) => cleanStr(raw) && !cleanDate(raw))) issues.push("Invalid follow-up date");
    if (id) {
      const c = (seen.get(id) ?? 0) + 1;
      seen.set(id, c);
      if (c > 1) issues.push("Duplicate lead ID");
    }
    leads.push({
      id: id || `row-${r}`,
      fullName: cleanStr(get(row, I.name)),
      phone: cleanStr(get(row, I.phone)),
      email: cleanStr(get(row, I.email)),
      createdAt,
      sourceId: cleanStr(get(row, I.sourceId)),
      sourceName: cleanStr(get(row, I.sourceName)) || "Unknown",
      memberId: cleanStr(get(row, I.memberId)),
      convertedAt: null,
      rawConvertedAt: convertedAt,
      stageName: cleanStr(get(row, I.stage)) || "Unknown",
      associate: cleanStr(get(row, I.associate)) || "Unassigned",
      remarks: cleanStr(get(row, I.remarks)),
      followUps,
      center: cleanStr(get(row, I.center)) || "Unassigned",
      classType: cleanStr(get(row, I.classType)) || "Unknown",
      hostId: resolveMomenceHost({ center: cleanStr(get(row, I.center)), hostId: cleanStr(get(row, I.hostId)) }),
      status: isWonStage(cleanStr(get(row, I.stage))) ? "Won" : /^won$/i.test(cleanStr(get(row, I.status))) ? "Open" : cleanStr(get(row, I.status)) || "Unknown",
      rawStatus: cleanStr(get(row, I.status)),
      won: isWonStage(cleanStr(get(row, I.stage))),
      channel: cleanStr(get(row, I.channel)) || "Unknown",
      period: cleanStr(get(row, I.period)),
      utmSource: cleanStr(get(row, I.us)),
      utmMedium: cleanStr(get(row, I.um)),
      utmCampaign: cleanStr(get(row, I.uc)),
      utmTerm: cleanStr(get(row, I.ut)),
      utmContent: cleanStr(get(row, I.ucon)),
      purchases,
      ltv,
      visits,
      trialStatus: "Unverified",
      rawTrialStatus: trialStatus || "Unknown",
      conversionStatus: "Unverified",
      rawConversionStatus: conversionStatus || "Unknown",
      retentionStatus: retentionStatus || "Unknown",
      converted: false,
      tried: false,
      trialCompletedAt: null,
      retained: /retained/i.test(retentionStatus) && !/^not/i.test(retentionStatus),
      followUpCount: recorded.length,
      firstFollowUp,
      daysToConversion: null,
      daysToFirstFollowUp:
        createdAt && firstFollowUp ? dayDiff(createdAt, firstFollowUp) : null,
      rowIndex: r + 1,
      issues,
      enriched: false,
      crossSheetFlags: [],
    });
  }
  // mark the first occurrence of duplicated IDs too
  const dupIds = new Set([...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k));
  for (const l of leads)
    if (dupIds.has(l.id) && !l.issues.includes("Duplicate lead ID"))
      l.issues.push("Duplicate lead ID");
  return { leads, headers };
}

/* -------------------------------- Caching -------------------------------- */
type Cache = {
  conversionRuleVersion: string;
  leads: Lead[];
  headers: string[];
  syncedAt: string | null;
  error: string | null;
  loading: Promise<void> | null;
  crossSheet?: import("./types").CrossSheetMeta | null;
};
const g = globalThis as unknown as { __leadCache?: Cache };
const cache: Cache =
  (g.__leadCache?.conversionRuleVersion === CONVERSION_RULE_VERSION ? g.__leadCache : null) ??
  (g.__leadCache = { conversionRuleVersion: CONVERSION_RULE_VERSION, leads: [], headers: [], syncedAt: null, error: null, loading: null, crossSheet: null });

export const TTL_MS = 5 * 60 * 1000;

export function enrichWithCrossSheet(
  leads: Lead[],
  sales: Map<string, import("./crossSheet").SaleAgg>,
  checkins: Map<string, import("./crossSheet").CheckinAgg>,
  checkinsAvailable = true,
) {
  let enrichedCount = 0;
  let totalLtv = 0;
  let totalVisits = 0;
  for (const l of leads) {
    const k1 = l.memberId ? l.memberId : "";
    const k2 = l.email ? l.email.toLowerCase() : "";
    const sale = (k1 && sales.get(k1)) || (k2 && sales.get(k2)) || null;
    const chk = (k1 && checkins.get(k1)) || (k2 && checkins.get(k2)) || null;

    // preserve raw
    l.rawLtv = l.ltv;
    l.rawPurchases = l.purchases;
    l.rawVisits = l.visits;
    l.rawTrialStatus ??= l.trialStatus;
    l.rawConversionStatus ??= l.conversionStatus;
    l.rawRetentionStatus = l.retentionStatus;
    l.crossSheetFlags = l.crossSheetFlags ?? [];
    l.enriched = false;

    // Conversion never uses email fallback or source labels/dates.
    const memberSales = l.memberId ? sales.get(l.memberId) : undefined;
    const qualifying = firstConversionSale(l.memberId, l.createdAt, memberSales?.conversionSales ?? []);
    l.converted = !!qualifying;
    l.conversionStatus = qualifying ? "Converted" : "Not Converted";
    l.convertedAt = qualifying?.date ?? null;
    l.daysToConversion = qualifying && l.createdAt ? dayDiff(l.createdAt, qualifying.date) : null;
    const memberCheckins = l.memberId ? checkins.get(l.memberId) : undefined;
    const visitDate = l.createdAt && memberCheckins?.memberId === l.memberId
      ? memberCheckins.checkedInDates.filter((date) => date >= l.createdAt!).sort()[0] : undefined;
    l.tried = !!visitDate;
    l.trialStatus = !checkinsAvailable ? "Unverified" : visitDate ? "Trial Completed" : "Not Tried";
    l.trialCompletedAt = visitDate ?? null;
    if (!sale && !chk) continue;

    let hasTruth = false;
    if (sale) {
      // purchases/ltv from sales truth (cols A:W core -> override X:AJ)
      const beforeLtv = l.ltv;
      l.purchases = sale.purchases;
      l.ltv = sale.ltv;
      l.firstSaleDate = sale.firstSale;
      l.lastSaleDate = sale.lastSale;
      hasTruth = true;
      totalLtv += sale.ltv;
      // discrepancy checks
      if ((beforeLtv ?? 0) !== sale.ltv) {
        if ((beforeLtv ?? 0) > 0 && sale.ltv === 0) l.crossSheetFlags.push("Sheet LTV >0 but Sales shows 0");
        else if (Math.abs((beforeLtv ?? 0) - sale.ltv) > 1) l.crossSheetFlags.push(`LTV mismatch: sheet ${beforeLtv} vs sales ${sale.ltv}`);
      }
    }
    if (chk) {
      l.visits = chk.visits;
      l.firstVisitDate = chk.firstVisit;
      l.lastVisitDate = chk.lastVisit;
      hasTruth = true;
      totalVisits += chk.visits;
      // retention: at least 3 visits or 2 purchases + last visit within 90d
      const isRetained = chk.visits >= 5 || (chk.visits >= 3 && (l.purchases ?? 0) >= 2);
      l.retained = isRetained;
      l.retentionStatus = isRetained ? "Retained" : "Not Retained";
    }

    if (hasTruth) {
      enrichedCount++;
      l.enriched = true;
      // recompute daysToConversion if changed
      if (l.createdAt && l.convertedAt) l.daysToConversion = Math.max(0, dayDiff(l.createdAt, l.convertedAt));
    }
    // merge crossSheetFlags into issues for visibility
    for (const f of l.crossSheetFlags) if (!l.issues.includes(f)) l.issues.push(f);
  }
  return { enrichedCount, totalLtv, totalVisits };
}

async function fetchWithRetry(url: string, tries = 3): Promise<string> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { cache: "no-store", redirect: "follow", headers: { "user-agent": "Mozilla/5.0 Lead-Intelligence" } });
    const text = await res.text();
    if (res.ok && !text.trim().startsWith("<") && !text.trim().startsWith("<!doctype")) return text;
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    if (i === tries - 1) {
      if (!res.ok) throw new Error(`Google Sheets responded ${res.status}`);
      if (text.trim().startsWith("<")) throw new Error("Sheet is not publicly accessible (received HTML — check sharing settings or quota)");
      throw new Error("Sheet fetch returned unexpected content");
    }
  }
  throw new Error("Sheet fetch failed");
}

async function doFetch() {
  const text = await fetchWithRetry(CSV_URL, 3);
  const { leads, headers } = normalise(parseCSV(text));

  // cross-sheet enrichment (never block lead load if Sales/Checkins fail)
  let crossSheetMeta: import("./types").CrossSheetMeta | null = null;
  let enrichmentError: string | null = null;
  try {
    const { fetchCrossSheet } = await import("./crossSheet");
    const cs = await fetchCrossSheet();
    const { enrichedCount, totalLtv, totalVisits } = enrichWithCrossSheet(leads, cs.sales, cs.checkins, cs.checkinsAvailable);
    if (!cs.checkinsAvailable) enrichmentError = "Check-ins source unavailable; Trial Completed is unverified. Eligible sales conversion remains verified.";
    crossSheetMeta = {
      salesRows: cs.stats.salesRows,
      checkinRows: cs.stats.checkinRows,
      matchedLeads: [...cs.sales.keys()].filter((k) => leads.some((l) => l.memberId === k || l.email.toLowerCase() === k)).length,
      enrichedLeads: enrichedCount,
      totalLtv,
      totalVisits,
      salesSyncedAt: new Date().toISOString(),
      checkinsSyncedAt: new Date().toISOString(),
    };
  } catch {
    enrichmentError = "Sales enrichment unavailable; conversion is unverified. Retry sync to verify conversion.";
  }

  cache.leads = leads;
  cache.headers = headers;
  cache.syncedAt = new Date().toISOString();
  cache.error = enrichmentError;
  cache.crossSheet = crossSheetMeta;
}

export async function getLeads(force = false): Promise<Cache> {
  const stale =
    !cache.syncedAt || Date.now() - new Date(cache.syncedAt).getTime() > TTL_MS;
  if (force || stale || !cache.leads.length) {
    if (!cache.loading) {
      cache.loading = doFetch()
        .catch((e: Error) => {
          cache.error = e.message;
        })
        .finally(() => {
          cache.loading = null;
        });
    }
    await cache.loading;
  }
  return cache;
}

export function patchLead(id: string, patch: Partial<Lead>) {
  const l = cache.leads.find((x) => x.id === id);
  if (l) {
    Object.assign(l, patch);
    l.won = isWonStage(l.stageName);
    if (l.won) l.status = "Won";
    else if (/^won$/i.test(l.status.trim())) l.status = "Open";
  }
}
