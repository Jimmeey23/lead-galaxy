import { NextResponse } from "next/server";
import { DEFAULT_CADENCE, cadenceCumulative, getCadence, setCadence } from "@/lib/cadence";

export const dynamic = "force-dynamic";

export async function GET() {
  const cadence = await getCadence();
  return NextResponse.json({ cadence, cumulative: cadenceCumulative(cadence), defaults: DEFAULT_CADENCE });
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const cadence = await setCadence(body);
    return NextResponse.json({ ok: true, cadence, cumulative: cadenceCumulative(cadence) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
