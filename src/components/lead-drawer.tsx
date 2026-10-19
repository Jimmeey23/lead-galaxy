"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Clock,
  Copy,
  Mail,
  Phone,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button, Chip, Drawer, Input } from "./ui";
import { cadenceForLead } from "@/lib/ai";
import { useCadenceConfig } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { fmtDate, inr, num } from "@/lib/format";

const EDIT_FIELDS: { key: keyof Lead; label: string }[] = [
  { key: "fullName", label: "Full Name" },
  { key: "phone", label: "Phone Number" },
  { key: "email", label: "Email" },
  { key: "associate", label: "Associate" },
  { key: "center", label: "Center" },
  { key: "classType", label: "Class Type" },
  { key: "stageName", label: "Stage Name" },
  { key: "status", label: "Status" },
  { key: "trialStatus", label: "Trial Status" },
  { key: "conversionStatus", label: "Conversion Status" },
  { key: "retentionStatus", label: "Retention Status" },
  { key: "remarks", label: "Remarks" },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-muted text-[12px]">{label}</span>
      <span className="num max-w-[62%] text-right text-[12.5px] font-medium break-words">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-faint mb-2 text-[11px] font-semibold tracking-wide uppercase">{title}</p>
      <div className="card px-4 py-1">{children}</div>
    </div>
  );
}

export function LeadDrawer({
  lead,
  onClose,
  onSaved,
}: {
  lead: Lead | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"profile" | "timeline" | "edit">("profile");
  const [patch, setPatch] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const { cadence: cadenceCfg } = useCadenceConfig();

  if (!lead) return null;

  const copy = (v: string, key: string) => {
    navigator.clipboard?.writeText(v);
    setCopied(key);
    setTimeout(() => setCopied(""), 1400);
  };

  const save = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/momence", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ updates: [{ id: lead.id, patch }] }),
      });
      const j = await res.json();
      setResult(j.results?.[0]?.message ?? "Done");
      if (j.succeeded) onSaved();
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const timeline = [
    lead.createdAt && { date: lead.createdAt, label: "Lead created", detail: `via ${lead.sourceName}` },
    ...lead.followUps
      .map((f, i) => f.date && { date: f.date, label: `Follow-up ${i + 1}`, detail: f.comment || "No comment recorded" })
      .filter(Boolean),
    lead.convertedAt && { date: lead.convertedAt, label: "Converted to customer", detail: lead.stageName },
  ].filter(Boolean) as { date: string; label: string; detail: string }[];
  timeline.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Drawer
      open={!!lead}
      onClose={onClose}
      width={580}
      title={lead.fullName || "Unnamed lead"}
      subtitle={`Lead #${lead.id} · ${lead.center} · ${lead.associate}`}
      footer={
        tab === "edit" ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-faint truncate text-[11.5px]">{result ?? "Changes are sent to Momence via PUT"}</span>
            <Button variant="primary" size="sm" onClick={save} disabled={saving || !Object.keys(patch).length}>
              <Save size={13} /> {saving ? "Saving…" : "Save to Momence"}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="mb-4 flex gap-1.5">
        {(["profile", "timeline", "edit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors"
            style={
              tab === t
                ? { background: "var(--accent-soft)", color: "var(--accent)" }
                : { color: "var(--text-muted)" }
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div>
          {(() => {
            const a = cadenceForLead(lead, undefined, cadenceCfg);
            const t = a.status === "missed" ? "critical" as const : a.status === "overdue" ? "warning" as const : a.status === "complete" ? "positive" as const : "info" as const;
            return (
              <div className="card mb-5 flex items-start gap-3 p-3" style={{ background: a.status === "missed" || a.status === "overdue" ? "var(--warning-soft)" : "var(--surface-2)" }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: a.status === "complete" ? "var(--positive-soft)" : a.status === "overdue" || a.status === "missed" ? "var(--warning-soft)" : "var(--info-soft)", color: a.status === "complete" ? "var(--positive)" : a.status === "overdue" || a.status === "missed" ? "var(--warning)" : "var(--info)" }}><Bot size={14} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold">AI cadence: {a.status} {a.overdueBy ? `· ${a.overdueBy}d overdue` : ""}</p>
                  <p className="text-muted text-[11.5px] leading-snug">{a.nextAction}</p>
                  <div className="mt-2 flex gap-1">{a.expected.map((e) => <span key={e.label} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium" style={{ background: e.state === "done" ? "var(--positive-soft)" : e.state === "overdue" ? "var(--critical-soft)" : e.state === "due" ? "var(--warning-soft)" : "var(--surface)", color: e.state === "done" ? "var(--positive)" : e.state === "overdue" ? "var(--critical)" : e.state === "due" ? "var(--warning)" : "var(--text-faint)" }}>{e.label}: {e.state}</span>)}</div>
                  {a.flags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{a.flags.slice(0, 4).map((f) => <Chip key={f} tone="warning"><ShieldAlert size={10} /> {f}</Chip>)}</div>}
                  <p className="text-faint mt-1.5 text-[11px]">Risk {a.riskScore}/100 · Opportunity {a.opportunityScore}/100</p>
                </div>
              </div>
            );
          })()}
          <div className="mb-5 flex flex-wrap gap-2">
            <Chip tone={lead.converted ? "positive" : "neutral"}>{lead.conversionStatus}</Chip>
            <Chip tone={lead.tried ? "info" : "neutral"}>{lead.trialStatus}</Chip>
            <Chip tone={lead.retained ? "positive" : "neutral"}>{lead.retentionStatus}</Chip>
            <Chip tone="accent">{lead.stageName}</Chip>
            {lead.enriched && <Chip tone="info"><Bot size={10} /> Sales/Check-ins enriched</Chip>}
          </div>
          <div className="mb-5 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(lead.phone, "p")} disabled={!lead.phone}>
              {copied === "p" ? <Check size={13} /> : <Phone size={13} />}
              <span className="truncate">{lead.phone || "No phone"}</span>
              <Copy size={11} className="opacity-50" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(lead.email, "e")} disabled={!lead.email}>
              {copied === "e" ? <Check size={13} /> : <Mail size={13} />}
              <span className="truncate">{lead.email || "No email"}</span>
              <Copy size={11} className="opacity-50" />
            </Button>
          </div>

          <Section title="Lead profile">
            <Row label="Created at" value={fmtDate(lead.createdAt)} />
            <Row label="Member ID" value={lead.memberId || "—"} />
            <Row label="Host ID" value={lead.hostId || "—"} />
            <Row label="Associate" value={lead.associate} />
            <Row label="Center" value={lead.center} />
            <Row label="Class type" value={lead.classType} />
            <Row label="Status" value={lead.status} />
          </Section>

          <Section title="Acquisition & attribution">
            <Row label="Source" value={`${lead.sourceName}${lead.sourceId ? ` (#${lead.sourceId})` : ""}`} />
            <Row label="Channel" value={lead.channel} />
            <Row label="UTM source" value={lead.utmSource || "—"} />
            <Row label="UTM medium" value={lead.utmMedium || "—"} />
            <Row label="UTM campaign" value={lead.utmCampaign || "—"} />
            <Row label="UTM term" value={lead.utmTerm || "—"} />
            <Row label="UTM content" value={lead.utmContent || "—"} />
          </Section>

          <Section title="Commercial summary">
            <Row label="Converted at" value={fmtDate(lead.convertedAt)} />
            <Row label="Days to conversion" value={lead.daysToConversion != null ? `${lead.daysToConversion} days` : "—"} />
            <Row label="Purchases made" value={num(lead.purchases)} />
            <Row label="LTV" value={inr(lead.ltv)} />
            <Row label="Visits" value={num(lead.visits)} />
          </Section>

          {lead.remarks && (
            <Section title="Remarks">
              <p className="py-2 text-[12.5px] leading-relaxed">{lead.remarks}</p>
            </Section>
          )}

          <Section title="Data quality flags">
            {lead.issues.length ? (
              <div className="flex flex-wrap gap-1.5 py-2.5">
                {lead.issues.map((i) => (
                  <Chip key={i} tone="warning">
                    <AlertTriangle size={11} /> {i}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-1.5 py-2.5 text-[12.5px]" style={{ color: "var(--positive)" }}>
                <Sparkles size={13} /> No anomalies detected on this record
              </p>
            )}
          </Section>
        </div>
      )}

      {tab === "timeline" && (
        <div className="relative pl-5">
          <span className="absolute top-1 bottom-1 left-[6px] w-px" style={{ background: "var(--border)" }} />
          {timeline.length ? (
            timeline.map((t, i) => (
              <div key={i} className="relative mb-5">
                <span
                  className="absolute top-1 -left-[19px] h-2.5 w-2.5 rounded-full border-2"
                  style={{ background: "var(--bg-elevated)", borderColor: "var(--accent)" }}
                />
                <p className="text-[12.5px] font-semibold">{t.label}</p>
                <p className="text-faint flex items-center gap-1 text-[11.5px]">
                  <Clock size={11} /> {fmtDate(t.date)}
                </p>
                <p className="text-muted mt-1 text-[12px] leading-relaxed">{t.detail}</p>
              </div>
            ))
          ) : (
            <p className="text-muted text-[12.5px]">No dated events recorded for this lead.</p>
          )}
          <div className="mt-4">
            <p className="text-faint mb-2 text-[11px] font-semibold uppercase">Follow-up records</p>
            <div className="card divide-y">
              {lead.followUps.map((f, i) => (
                <div key={i} className="px-3 py-2">
                  <div className="flex justify-between text-[12px]">
                    <span className="font-medium">Follow-up {i + 1}</span>
                    <span className="num text-muted">{f.date ? fmtDate(f.date) : "no date"}</span>
                  </div>
                  <p className="text-muted mt-0.5 text-[12px]">{f.comment || "— no comment recorded —"}</p>
                </div>
              ))}
            </div>
            <p className="text-faint mt-2 text-[11px]">
              A recorded date does not confirm that contact was made; it reflects what is stored in the sheet.
            </p>
          </div>
        </div>
      )}

      {tab === "edit" && (
        <div className="space-y-3">
          <p className="text-muted rounded-lg border px-3 py-2 text-[12px]" style={{ background: "var(--surface-2)" }}>
            Edits are pushed to Momence with a PUT request to
            <code className="mx-1 text-[11.5px]">/host/{lead.hostId || "13752"}/customer-leads/{lead.id}</code>
            using the server-side <code>MOMENCE_ALL_COOKIES</code> credential.
          </p>
          {EDIT_FIELDS.map((f) => (
            <div key={String(f.key)}>
              <p className="text-faint mb-1 text-[11px]">{f.label}</p>
              <Input
                value={patch[f.key as string] ?? String(lead[f.key] ?? "")}
                onChange={(e) => setPatch((p) => ({ ...p, [f.key as string]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
