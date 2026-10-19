export const nf = new Intl.NumberFormat("en-IN");

export const num = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const inr = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `₹${num(Math.round(n))}`;

export const inrCompact = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
};

export const pctStr = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(digits)}%`;

export const days = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(1)} d`;

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00Z");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const delta = (cur: number, prev: number) => {
  const abs = cur - prev;
  if (!prev) return { abs, pct: cur ? null : 0, up: abs >= 0 };
  return { abs, pct: (abs / Math.abs(prev)) * 100, up: abs >= 0 };
};

export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");
