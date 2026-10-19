export type Lead = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  createdAt: string | null; // ISO date (yyyy-mm-dd)
  sourceId: string;
  sourceName: string;
  memberId: string;
  convertedAt: string | null;
  stageName: string;
  associate: string;
  remarks: string;
  followUps: { date: string | null; comment: string }[];
  center: string;
  classType: string;
  hostId: string;
  status: string;
  channel: string;
  period: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  purchases: number | null;
  ltv: number | null;
  visits: number | null;
  trialStatus: string;
  conversionStatus: string;
  retentionStatus: string;
  // derived
  converted: boolean;
  won: boolean;
  trialCompletedAt?: string | null;
  rawStatus?: string;
  tried: boolean;
  retained: boolean;
  followUpCount: number;
  firstFollowUp: string | null;
  daysToConversion: number | null;
  daysToFirstFollowUp: number | null;
  rowIndex: number;
  issues: string[];
  // cross-sheet truth (cols A:W core + Sales/Checkins)
  rawPurchases?: number | null;
  rawLtv?: number | null;
  rawVisits?: number | null;
  rawTrialStatus?: string;
  rawConversionStatus?: string;
  rawConvertedAt?: string | null;
  rawRetentionStatus?: string;
  enriched?: boolean;
  firstSaleDate?: string | null;
  lastSaleDate?: string | null;
  firstVisitDate?: string | null;
  lastVisitDate?: string | null;
  crossSheetFlags?: string[];
  // AI fields (computed on the fly but storable)
  cadenceStatus?: string;
  nextDue?: string | null;
  overdueBy?: number | null;
  riskScore?: number;
  opportunityScore?: number;
};

export type FilterState = {
  dateDimension: "createdAt" | "convertedAt" | "followUp";
  preset: string;
  from?: string | null;
  to?: string | null;
  compare?: string; // none | previous | lastMonth | lastYear
  search?: string;
  center?: string[];
  associate?: string[];
  sourceName?: string[];
  channel?: string[];
  stageName?: string[];
  status?: string[];
  trialStatus?: string[];
  conversionStatus?: string[];
  retentionStatus?: string[];
  classType?: string[];
  utmCampaign?: string[];
  utmSource?: string[];
  utmMedium?: string[];
  ltvMin?: number | null;
  ltvMax?: number | null;
  visitsMin?: number | null;
  visitsMax?: number | null;
  purchasesMin?: number | null;
  followUpActivity?: string; // any | none | withFollowUps | 1 | 2 | 3 | 4
  advanced?: AdvGroup | null;
};

export type AdvCond = {
  field: string;
  op: string;
  value: string;
};
export type AdvGroup = {
  combinator: "AND" | "OR";
  conditions: AdvCond[];
};

export type CrossSheetMeta = {
  salesRows: number;
  checkinRows: number;
  matchedLeads: number;
  enrichedLeads: number;
  totalLtv: number;
  totalVisits: number;
  salesSyncedAt: string | null;
  checkinsSyncedAt: string | null;
};
