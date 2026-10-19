import { getLeads } from "@/lib/sheet";
import { applyFilters } from "@/lib/filters";
import type { FilterState, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

const COLUMNS: { key: string; label: string; get: (l: Lead) => string | number | null }[] = [
  { key: "id", label: "ID", get: (l) => l.id },
  { key: "fullName", label: "Full Name", get: (l) => l.fullName },
  { key: "phone", label: "Phone Number", get: (l) => l.phone },
  { key: "email", label: "Email", get: (l) => l.email },
  { key: "createdAt", label: "Created At", get: (l) => l.createdAt },
  { key: "sourceId", label: "Source ID", get: (l) => l.sourceId },
  { key: "sourceName", label: "Source Name", get: (l) => l.sourceName },
  { key: "memberId", label: "Member ID", get: (l) => l.memberId },
  { key: "convertedAt", label: "Converted To Customer At", get: (l) => l.convertedAt },
  { key: "stageName", label: "Stage Name", get: (l) => l.stageName },
  { key: "associate", label: "Associate", get: (l) => l.associate },
  { key: "remarks", label: "Remarks", get: (l) => l.remarks },
  { key: "fu1d", label: "Follow Up 1 Date", get: (l) => l.followUps[0]?.date ?? "" },
  { key: "fu1c", label: "Follow Up Comments (1)", get: (l) => l.followUps[0]?.comment ?? "" },
  { key: "fu2d", label: "Follow Up 2 Date", get: (l) => l.followUps[1]?.date ?? "" },
  { key: "fu2c", label: "Follow Up Comments (2)", get: (l) => l.followUps[1]?.comment ?? "" },
  { key: "fu3d", label: "Follow Up 3 Date", get: (l) => l.followUps[2]?.date ?? "" },
  { key: "fu3c", label: "Follow Up Comments (3)", get: (l) => l.followUps[2]?.comment ?? "" },
  { key: "fu4d", label: "Follow Up 4 Date", get: (l) => l.followUps[3]?.date ?? "" },
  { key: "fu4c", label: "Follow Up Comments (4)", get: (l) => l.followUps[3]?.comment ?? "" },
  { key: "center", label: "Center", get: (l) => l.center },
  { key: "classType", label: "Class Type", get: (l) => l.classType },
  { key: "hostId", label: "Host ID", get: (l) => l.hostId },
  { key: "status", label: "Status", get: (l) => l.status },
  { key: "channel", label: "Channel", get: (l) => l.channel },
  { key: "period", label: "Period", get: (l) => l.period },
  { key: "utmSource", label: "UTM Source", get: (l) => l.utmSource },
  { key: "utmMedium", label: "UTM Medium", get: (l) => l.utmMedium },
  { key: "utmCampaign", label: "UTM Campaign", get: (l) => l.utmCampaign },
  { key: "utmTerm", label: "UTM Term", get: (l) => l.utmTerm },
  { key: "utmContent", label: "UTM Content", get: (l) => l.utmContent },
  { key: "purchases", label: "Purchases Made", get: (l) => l.purchases },
  { key: "ltv", label: "LTV", get: (l) => l.ltv },
  { key: "visits", label: "Visits", get: (l) => l.visits },
  { key: "trialStatus", label: "Trial Status", get: (l) => l.trialStatus },
  { key: "conversionStatus", label: "Conversion Status", get: (l) => l.conversionStatus },
  { key: "retentionStatus", label: "Retention Status", get: (l) => l.retentionStatus },
];

const esc = (v: string | number | null) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function POST(req: Request) {
  const { filters, format } = (await req.json()) as {
    filters: FilterState;
    format?: "csv" | "xls";
  };
  const cache = await getLeads();
  const rows = applyFilters(cache.leads, filters);
  if (format === "xls") {
    const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr>${COLUMNS.map(
      (c) => `<th>${c.label}</th>`,
    ).join("")}</tr>${rows
      .map(
        (l) =>
          `<tr>${COLUMNS.map((c) => `<td>${String(c.get(l) ?? "").replace(/</g, "&lt;")}</td>`).join("")}</tr>`,
      )
      .join("")}</table></body></html>`;
    return new Response(html, {
      headers: {
        "content-type": "application/vnd.ms-excel;charset=utf-8",
        "content-disposition": `attachment; filename="leads-${Date.now()}.xls"`,
      },
    });
  }
  const csv = [
    COLUMNS.map((c) => c.label).join(","),
    ...rows.map((l) => COLUMNS.map((c) => esc(c.get(l))).join(",")),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv;charset=utf-8",
      "content-disposition": `attachment; filename="leads-${Date.now()}.csv"`,
    },
  });
}
