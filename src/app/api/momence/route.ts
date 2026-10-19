import { NextResponse } from "next/server";
import { getLeads, patchLead } from "@/lib/sheet";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Fields the UI is allowed to edit, mapped to Momence payload keys */
export const EDITABLE: { field: keyof Lead; label: string; momence: string }[] = [
  { field: "fullName", label: "Full Name", momence: "name" },
  { field: "phone", label: "Phone Number", momence: "phoneNumber" },
  { field: "email", label: "Email", momence: "email" },
  { field: "remarks", label: "Remarks", momence: "remarks" },
  { field: "associate", label: "Associate", momence: "associate" },
  { field: "center", label: "Center", momence: "center" },
  { field: "classType", label: "Class Type", momence: "type" },
  { field: "stageName", label: "Stage Name", momence: "stage" },
  { field: "status", label: "Status", momence: "status" },
  { field: "trialStatus", label: "Trial Status", momence: "trialStatus" },
  { field: "conversionStatus", label: "Conversion Status", momence: "conversionStatus" },
  { field: "retentionStatus", label: "Retention Status", momence: "retentionStatus" },
];

const ddmmyy = (iso: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

function buildPayload(lead: Lead, patch: Record<string, string>) {
  const merged = { ...(lead as unknown as Record<string, unknown>), ...patch } as Record<string, string>;
  const full = String(merged.fullName ?? "").trim();
  const [firstName, ...rest] = full.split(" ");
  const fu = lead.followUps;
  return {
    phoneNumber: String(merged.phone ?? ""),
    sourceId: Number(lead.sourceId) || undefined,
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    email: String(merged.email ?? ""),
    date: ddmmyy(lead.createdAt),
    remarks: String(merged.remarks ?? ""),
    time: "",
    center: String(merged.center ?? ""),
    type: String(merged.classType ?? ""),
    utm_source: lead.utmSource,
    utm_campaign: lead.utmCampaign,
    zipCode: "",
    discoveryAnswer: "",
    age: "",
    fu1D: fu[0]?.date ? ddmmyy(fu[0].date) : "",
    fu1C: fu[0]?.comment ?? "",
    fu2D: fu[1]?.date ? ddmmyy(fu[1].date) : "",
    fu2C: fu[1]?.comment ?? "",
    FU3D: fu[2]?.date ? ddmmyy(fu[2].date) : "",
    FU3C: fu[2]?.comment ?? "",
    terms: "",
    class: "",
    fu4D: fu[3]?.date ? ddmmyy(fu[3].date) : "",
    fu4C: fu[3]?.comment ?? "",
    associate: String(merged.associate ?? ""),
    size: "",
    channel: lead.channel === "Unknown" ? "" : lead.channel,
    childName: "",
    batch: "",
    dob: "",
  };
}

async function pushOne(lead: Lead, patch: Record<string, string>) {
  const cookies = process.env.MOMENCE_ALL_COOKIES;
  const hostId = lead.hostId || process.env.MOMENCE_HOST_ID || "13752";
  const url = `https://momence.com/_api/primary/host/${hostId}/customer-leads/${lead.id}`;
  const payload = buildPayload(lead, patch);
  if (!cookies) {
    return {
      id: lead.id,
      ok: false,
      status: 0,
      message:
        "MOMENCE_ALL_COOKIES is not configured — the change was applied locally only and was not sent to Momence.",
      localOnly: true,
    };
  }
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json",
        cookie: cookies,
        origin: "https://momence.com",
        referer: `https://momence.com/dashboard/${hostId}/leads/${lead.id}`,
        "x-origin": `https://momence.com/dashboard/${hostId}/leads/${lead.id}`,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return {
      id: lead.id,
      ok: res.ok,
      status: res.status,
      message: res.ok ? "Updated in Momence" : text.slice(0, 300),
    };
  } catch (e) {
    return { id: lead.id, ok: false, status: 0, message: (e as Error).message };
  }
}

export async function GET() {
  return NextResponse.json({
    configured: !!process.env.MOMENCE_ALL_COOKIES,
    hostId: process.env.MOMENCE_HOST_ID || "13752",
    editableFields: EDITABLE.map((e) => e.label),
  });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    updates: { id: string; patch: Record<string, string> }[];
  };
  const cache = await getLeads();
  const results = [];
  for (const u of body.updates.slice(0, 500)) {
    const lead = cache.leads.find((l) => l.id === u.id);
    if (!lead) {
      results.push({ id: u.id, ok: false, status: 404, message: "Lead not found" });
      continue;
    }
    const r = await pushOne(lead, u.patch);
    // optimistic local cache update so the UI reconciles immediately
    patchLead(u.id, u.patch as unknown as Partial<Lead>);
    results.push(r);
  }
  return NextResponse.json({
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    configured: !!process.env.MOMENCE_ALL_COOKIES,
  });
}
