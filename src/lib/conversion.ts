/** Canonical lead conversion: exact Member ID + eligible sale after creation day. */
export const CONVERSION_RULE_VERSION = "member-eligible-sale-v1";
export const CONVERSION_DEFINITION = "Converted only when the same Member ID has a succeeded, non-voided, positive-value sale on a calendar date after lead creation. Excludes retail, money-credit products, 2-for-1, Intro Pack, Copper & Cloves Single Class Package and Copper + Cloves Credit. Email and source conversion labels/dates do not establish conversion; same-day purchases do not qualify.";

export type ConversionSale = { memberId: string; date: string; value: number };
export type SaleEligibilityInput = {
  memberId: string; date: string | null; value: number | null;
  paymentStatus: string; voided: boolean;
  category: string; product: string; paymentItem: string; membershipName: string;
};
const normalized = (value: string) => value.normalize("NFKC").toLowerCase()
  .replace(/[&+]/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

const validDay = (value: string | null): value is string => !!value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

export function isEligibleConversionSale(sale: SaleEligibilityInput): boolean {
  if (!sale.memberId.trim() || !validDay(sale.date) || !Number.isFinite(sale.value) || (sale.value ?? 0) <= 0 ||
    sale.paymentStatus.trim().toLowerCase() !== "succeeded" || sale.voided) return false;
  const names = [sale.category, sale.product, sale.paymentItem, sale.membershipName].map(normalized);
  return !names.some((name) =>
    /\bretail\b|\bmoney credits?\b|\b2 for 1\b|\bintro pack\b/.test(name) ||
    /\bcopper(?: and)? cloves (?:single class package|credit)\b/.test(name));
}

export function firstConversionSale(memberId: string, createdAt: string | null, sales: readonly ConversionSale[]): ConversionSale | null {
  if (!memberId.trim() || !validDay(createdAt)) return null;
  return sales.reduce<ConversionSale | null>((first, sale) =>
    sale.memberId === memberId && sale.date > createdAt && (!first || sale.date < first.date) ? sale : first, null);
}
