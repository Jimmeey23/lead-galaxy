import { cleanDate, cleanNum, cleanStr, parseCSV } from "./sheet";

/* ----------------------------- IDs -------------------------------- */
export const SALES_SHEET_ID =
  process.env.SALES_SHEET_ID || "1HbGnJk-peffUp7XoXSlsL55924E9yUt8cP_h93cdTT0";
export const CHECKINS_SHEET_ID =
  process.env.CHECKINS_SHEET_ID || "1a7XKv2WCog7o8nYuV8YcFdqtfPYJNRO6DelJ6Hn_z6Q";
const SALES_CSV = `https://docs.google.com/spreadsheets/d/${SALES_SHEET_ID}/export?format=csv&gid=0`;
const CHECKINS_CSV = `https://docs.google.com/spreadsheets/d/${CHECKINS_SHEET_ID}/export?format=csv&gid=0`;

/* ----------------------------- Types -------------------------------- */
export type SaleAgg = {
  memberId: string;
  email: string;
  purchases: number;
  ltv: number;
  firstSale: string | null;
  lastSale: string | null;
  byLocation: Record<string, { purchases: number; ltv: number }>;
  raw: number; // total rows
};

export type CheckinAgg = {
  memberId: string;
  email: string;
  visits: number; // Checked In = TRUE
  complementary: number;
  lateCancelled: number;
  firstVisit: string | null;
  lastVisit: string | null;
  trialVisits: number;
  paidVisits: number;
  uniqueSessions: number;
  byLocation: Record<string, number>;
  byMonth: Record<string, number>;
};

type ColMap = Record<string, number>;
const col = (headers: string[], name: string) =>
  headers.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase());

function mapHeaders(headers: string[]) {
  const m: ColMap = {};
  for (const h of headers) m[h.trim().toLowerCase()] = col(headers, h);
  return m;
}

function csvFetch(url: string): Promise<string> {
  return fetch(url, { cache: "no-store", redirect: "follow" }).then(async (r) => {
    if (!r.ok) throw new Error(`CSV fetch ${r.status} from ${url.slice(0, 60)}`);
    const t = await r.text();
    if (t.trim().startsWith("<")) throw new Error("Sheet not public");
    return t;
  });
}

/* ----------------------------- Sales aggregation -------------------------------- */
export async function fetchSalesAggs(): Promise<Map<string, SaleAgg>> {
  let text: string;
  try {
    text = await csvFetch(SALES_CSV);
  } catch {
    return new Map();
  }
  const rows = parseCSV(text);
  if (!rows.length) return new Map();
  const headers = rows[0].map((h) => h.trim());
  const idx = mapHeaders(headers);
  const iMid = idx["member id"] ?? idx["member id "] ?? -1;
  const iEmail = idx["customer email"] ?? -1;
  const iPayVal = idx["payment value"] ?? -1;
  const iStatus = idx["payment status"] ?? -1;
  const iDate = idx["payment date"] ?? -1;
  const iLoc = idx["calculated location"] ?? -1;
  const iVoided = idx["sec. is voided"] ?? -1;
  const iPayItem = idx["payment item"] ?? -1;

  const byMember = new Map<string, SaleAgg>();
  const keyFor = (mid: string, email: string) => mid || email.toLowerCase();

  function getAgg(mid: string, email: string): SaleAgg {
    const k = keyFor(mid, email);
    let a = byMember.get(k);
    if (!a) {
      a = {
        memberId: mid,
        email: email.toLowerCase(),
        purchases: 0,
        ltv: 0,
        firstSale: null,
        lastSale: null,
        byLocation: {},
        raw: 0,
      };
      byMember.set(k, a);
    }
    return a;
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const mid = cleanStr(row[iMid]);
    const email = cleanStr(row[iEmail]);
    if (!mid && !email) continue;
    const status = cleanStr(row[iStatus]).toLowerCase();
    const voided = cleanStr(row[iVoided]).toLowerCase() === "true";
    const isSucceeded = status === "succeeded" && !voided;
    const val = cleanNum(row[iPayVal]);
    const date = cleanDate(row[iDate]);
    const loc = cleanStr(row[iLoc]) || "Unknown";
    const agg = getAgg(mid, email);
    agg.raw++;
    if (isSucceeded) {
      agg.purchases++;
      if (val != null) agg.ltv += val;
      if (date) {
        if (!agg.firstSale || date < agg.firstSale) agg.firstSale = date;
        if (!agg.lastSale || date > agg.lastSale) agg.lastSale = date;
      }
      agg.byLocation[loc] = agg.byLocation[loc] || { purchases: 0, ltv: 0 };
      agg.byLocation[loc].purchases++;
      if (val) agg.byLocation[loc].ltv += val;
    }
  }
  return byMember;
}

/* ----------------------------- Checkins aggregation -------------------------------- */
export async function fetchCheckinAggs(): Promise<Map<string, CheckinAgg>> {
  let text: string;
  try {
    text = await csvFetch(CHECKINS_CSV);
  } catch {
    return new Map();
  }
  const rows = parseCSV(text);
  if (!rows.length) return new Map();
  const headers = rows[0].map((h) => h.trim());
  const idx = mapHeaders(headers);
  const iMid = idx["member id"] ?? -1;
  const iEmail = idx["email"] ?? -1;
  const iChecked = idx["checked in"] ?? -1;
  const iComp = idx["complementary"] ?? -1;
  const iLate = idx["is late cancelled"] ?? -1;
  const iLoc = idx["location"] ?? -1;
  const iDate = idx["date (ist)"] ?? -1;
  const iProd = idx["cleaned product"] ?? -1;
  const iCat = idx["cleaned category"] ?? -1;
  const iIsNew = idx["is new"] ?? -1;
  const iSess = idx["session id"] ?? -1;

  const byMember = new Map<string, CheckinAgg>();
  const keyFor = (mid: string, email: string) => mid || email.toLowerCase();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const mid = cleanStr(row[iMid]);
    const email = cleanStr(row[iEmail]);
    if (!mid && !email) continue;
    const k = keyFor(mid, email);
    let a = byMember.get(k);
    if (!a) {
      a = {
        memberId: mid,
        email: email.toLowerCase(),
        visits: 0,
        complementary: 0,
        lateCancelled: 0,
        firstVisit: null,
        lastVisit: null,
        trialVisits: 0,
        paidVisits: 0,
        uniqueSessions: 0,
        byLocation: {},
        byMonth: {},
      };
      byMember.set(k, a);
    }
    const checked = cleanStr(row[iChecked]).toLowerCase() === "true";
    const comp = cleanStr(row[iComp]).toLowerCase() === "true";
    const late = cleanStr(row[iLate]).toLowerCase() === "true";
    const loc = cleanStr(row[iLoc]) || "Unknown";
    const date = cleanDate(row[iDate]);
    const cat = cleanStr(row[iCat]).toLowerCase();
    const isNew = cleanStr(row[iIsNew]).toLowerCase();
    const prod = cleanStr(row[iProd]).toLowerCase();

    if (late) a.lateCancelled++;
    if (comp) a.complementary++;
    if (!checked) continue;

    a.visits++;
    if (date) {
      if (!a.firstVisit || date < a.firstVisit) a.firstVisit = date;
      if (!a.lastVisit || date > a.lastVisit) a.lastVisit = date;
      const m = date.slice(0, 7);
      a.byMonth[m] = (a.byMonth[m] ?? 0) + 1;
    }
    a.byLocation[loc] = (a.byLocation[loc] ?? 0) + 1;
    // trial detection
    if (isNew.includes("trial") || cat.includes("complimentary") || isNew.includes("trial class") || prod.includes("trial")) {
      a.trialVisits++;
    } else {
      a.paidVisits++;
    }
  }
  // unique sessions approx: use byLocation? we didn't track session id per agg to keep lean
  return byMember;
}

export type CrossSheetStats = {
  salesRows: number;
  checkinRows: number;
  matchedLeads: number;
  enrichedLtv: number;
  enrichedVisits: number;
  salesUpdatedAt: string | null;
  checkinsUpdatedAt: string | null;
};

export async function fetchCrossSheet(): Promise<{
  sales: Map<string, SaleAgg>;
  checkins: Map<string, CheckinAgg>;
  stats: CrossSheetStats;
}> {
  const [sales, checkins] = await Promise.all([fetchSalesAggs(), fetchCheckinAggs()]);
  const salesRows = [...sales.values()].reduce((n, v) => n + v.raw, 0);
  const checkinRows = [...checkins.values()].reduce((n, v) => n + v.visits + v.lateCancelled, 0);
  return {
    sales,
    checkins,
    stats: {
      salesRows,
      checkinRows,
      matchedLeads: 0,
      enrichedLtv: 0,
      enrichedVisits: 0,
      salesUpdatedAt: sales.size ? new Date().toISOString() : null,
      checkinsUpdatedAt: checkins.size ? new Date().toISOString() : null,
    },
  };
}
