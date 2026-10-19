import { NextResponse } from "next/server";
import { getLeads } from "@/lib/sheet";
import { applyFilters } from "@/lib/filters";
import { analyze, cadenceForLead } from "@/lib/ai";
import { getCadence } from "@/lib/cadence";
import type { FilterState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { filters, leadId } = (await req.json()) as { filters: FilterState; leadId?: string };
  const cache = await getLeads();
  if (cache.error && !cache.leads.length)
    return NextResponse.json({ error: cache.error }, { status: 502 });

  const cadenceConfig = await getCadence();

  if (leadId) {
    const lead = cache.leads.find((l) => l.id === leadId);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json({ cadence: cadenceForLead(lead, undefined, cadenceConfig), lead: { id: lead.id, fullName: lead.fullName, enriched: lead.enriched, crossSheetFlags: lead.crossSheetFlags } });
  }

  const rows = applyFilters(cache.leads, filters);
  const analysis = analyze(rows, cadenceConfig);

  // top actionable list: combine
  const actionable = [...analysis.missedFollowups.slice(0, 12), ...analysis.missedOpportunities.slice(0, 12)]
    .map((r) => ({
      id: r.id,
      fullName: r.fullName,
      reason: r.status === "overdue" || r.status === "missed" ? `Cadence ${r.status} — ${r.nextAction}` : `Opportunity score ${r.opportunityScore}`,
      risk: r.riskScore,
      opportunity: r.opportunityScore,
      associate: r.associate,
      center: r.center,
      nextDue: r.nextDue,
    }))
    .slice(0, 20);

  return NextResponse.json({
    meta: { filtered: rows.length, total: cache.leads.length, syncedAt: cache.syncedAt, crossSheet: cache.crossSheet ?? null },
    analysis,
    actionable,
  });
}
