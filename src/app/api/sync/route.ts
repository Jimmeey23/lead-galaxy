import { NextResponse } from "next/server";
import { getLeads, SHEET_URL } from "@/lib/sheet";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = await getLeads(false);
  return NextResponse.json({
    syncedAt: c.syncedAt,
    rows: c.leads.length,
    headers: c.headers,
    error: c.error,
    sheetUrl: SHEET_URL,
    crossSheet: c.crossSheet ?? null,
  });
}

export async function POST() {
  const c = await getLeads(true);
  return NextResponse.json({
    syncedAt: c.syncedAt,
    rows: c.leads.length,
    error: c.error,
    sheetUrl: SHEET_URL,
    crossSheet: c.crossSheet ?? null,
  });
}
