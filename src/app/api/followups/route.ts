import { resolveMomenceHost } from "@/lib/momence-host";
import { momenceFetch, momenceConfigured } from "@/lib/momence-auth";
import { NextResponse } from "next/server";
import { getLeads, patchLead } from "@/lib/sheet";
import { cleanDate } from "@/lib/sheet";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const { id, index, date, comment } = (await req.json()) as {
    id: string;
    index: number; // 0-3
    date?: string;
    comment?: string;
  };
  if (index < 0 || index > 3) return NextResponse.json({ error: "index must be 0-3" }, { status: 400 });
  const cache = await getLeads();
  const lead = cache.leads.find((l) => l.id === id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const cleanD = date ? cleanDate(date) : null;
  const patchKeyDate = ["fu1D", "fu2D", "FU3D", "fu4D"][index];
  const patchKeyComm = ["fu1C", "fu2C", "FU3C", "fu4C"][index];

  // local optimistic update
  const newFu = [...lead.followUps];
  newFu[index] = { date: cleanD, comment: (comment ?? newFu[index]?.comment ?? "").trim() };
  const recorded = newFu.filter((f) => f.date || f.comment);
  const fuDates = newFu.map((f) => f.date).filter((d): d is string => !!d).sort();
  patchLead(id, {
    followUps: newFu,
    followUpCount: recorded.length,
    firstFollowUp: fuDates[0] ?? null,
    daysToFirstFollowUp: lead.createdAt && fuDates[0] ? Math.round((new Date(fuDates[0] + "T00:00:00Z").getTime() - new Date(lead.createdAt + "T00:00:00Z").getTime()) / 86400000) : null,
  } as unknown as Partial<import("@/lib/types").Lead>);

  // forward to Momence (same logic as momence route but only FU fields)
  const configured = momenceConfigured();
  const hostId = resolveMomenceHost(lead);
  let momence: { ok: boolean; message: string } | null = null;
  if (configured) {
    try {
      const payload: Record<string, string> = {
        [patchKeyDate]: cleanD ? `${cleanD.slice(8, 10)}/${cleanD.slice(5, 7)}/${cleanD.slice(2, 4)}` : "",
        [patchKeyComm]: (comment ?? newFu[index].comment) ?? "",
      };
      // we need to build full payload; reuse simple payload with current lead + patched FU
      const full = {
        phoneNumber: lead.phone,
        sourceId: Number(lead.sourceId) || undefined,
        firstName: lead.fullName.split(" ")[0] ?? "",
        lastName: lead.fullName.split(" ").slice(1).join(" "),
        email: lead.email,
        date: lead.createdAt ? `${lead.createdAt.slice(8, 10)}/${lead.createdAt.slice(5, 7)}/${lead.createdAt.slice(2, 4)}` : "",
        remarks: lead.remarks,
        center: lead.center,
        type: lead.classType,
        associate: lead.associate,
        fu1D: index === 0 ? payload.fu1D : lead.followUps[0]?.date ? `${lead.followUps[0].date!.slice(8, 10)}/${lead.followUps[0].date!.slice(5, 7)}/${lead.followUps[0].date!.slice(2, 4)}` : "",
        fu1C: index === 0 ? payload.fu1C : lead.followUps[0]?.comment ?? "",
        fu2D: index === 1 ? payload.fu2D : lead.followUps[1]?.date ? `${lead.followUps[1].date!.slice(8, 10)}/${lead.followUps[1].date!.slice(5, 7)}/${lead.followUps[1].date!.slice(2, 4)}` : "",
        fu2C: index === 1 ? payload.fu2C : lead.followUps[1]?.comment ?? "",
        FU3D: index === 2 ? payload.FU3D : lead.followUps[2]?.date ? `${lead.followUps[2].date!.slice(8, 10)}/${lead.followUps[2].date!.slice(5, 7)}/${lead.followUps[2].date!.slice(2, 4)}` : "",
        FU3C: index === 2 ? payload.FU3C : lead.followUps[2]?.comment ?? "",
        fu4D: index === 3 ? payload.fu4D : lead.followUps[3]?.date ? `${lead.followUps[3].date!.slice(8, 10)}/${lead.followUps[3].date!.slice(5, 7)}/${lead.followUps[3].date!.slice(2, 4)}` : "",
        fu4C: index === 3 ? payload.fu4C : lead.followUps[3]?.comment ?? "",
      };
      const res = await momenceFetch(`https://momence.com/_api/primary/host/${hostId}/customer-leads/${lead.id}`, {
        method: "PUT",
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json",
                    origin: "https://momence.com",
          referer: `https://momence.com/dashboard/${hostId}/leads/${lead.id}`,
          "x-origin": `https://momence.com/dashboard/${hostId}/leads/${lead.id}`,
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
        },
        body: JSON.stringify(full),
      });
      const txt = await res.text();
      momence = { ok: res.ok, message: res.ok ? "Synced to Momence" : txt.slice(0, 280) };
    } catch (e) {
      momence = { ok: false, message: (e as Error).message };
    }
  } else {
    momence = { ok: false, message: "MOMENCE_ALL_COOKIES not configured — saved locally only" };
  }

  return NextResponse.json({ ok: true, lead: { ...lead, followUps: newFu }, momence });
}
