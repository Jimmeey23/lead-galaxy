"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Timer,
  XCircle,
} from "lucide-react";
import { Button, Card, Chip, Input, Select } from "./ui";
import { invalidateCadence, useApp } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import { DEFAULT_CADENCE, type CadenceConfig } from "@/lib/cadence-config";
import type { Analytics } from "./modules";

export function SettingsModule({ a, onRefresh }: { a: Analytics; onRefresh: () => void }) {
  const { theme, setTheme, autoRefresh, setAutoRefresh, savedViews, deleteView, bumpRefresh } = useApp();
  const [momence, setMomence] = useState<{ configured: boolean; hostId: string; editableFields: string[] } | null>(null);
  const [sheet, setSheet] = useState<{ sheetUrl: string; rows: number; error: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/momence").then((r) => r.json()).then(setMomence).catch(() => {});
    fetch("/api/sync").then((r) => r.json()).then(setSheet).catch(() => {});
  }, []);

  const Status = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: ok ? "var(--positive)" : "var(--critical)" }}>
      {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {label}
    </span>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CadenceEditor onSaved={bumpRefresh} />

      <Card title="Google Sheets integration" subtitle="Read-only source of truth — the app never writes back to the sheet">
        <div className="space-y-2.5 text-[12.5px]">
          <Status ok={!a.meta.error} label={a.meta.error ? `Error: ${a.meta.error}` : "Connected to the ◉ Leads worksheet"} />
          <p className="text-muted">Rows loaded: <span className="num font-medium">{a.meta.totalRows.toLocaleString()}</span></p>
          {a.meta.crossSheet && (
            <p className="text-muted">
              Cross-sheet truth: <span className="num font-medium">{a.meta.crossSheet.salesRows.toLocaleString()}</span> sales rows ·{" "}
              <span className="num font-medium">{a.meta.crossSheet.checkinRows.toLocaleString()}</span> check-ins ·{" "}
              <span className="num font-medium">{a.meta.crossSheet.enrichedLeads.toLocaleString()}</span> leads enriched
            </p>
          )}
          <p className="text-muted">Last successful sync: <span className="font-medium">{fmtDateTime(a.meta.syncedAt)}</span> (Asia/Kolkata)</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="primary" size="sm" onClick={onRefresh}><RefreshCw size={13} /> Sync now</Button>
            {sheet?.sheetUrl && (
              <a href={sheet.sheetUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm"><ExternalLink size={13} /> Open spreadsheet</Button>
              </a>
            )}
          </div>
          <div className="pt-2">
            <p className="text-faint mb-1 text-[11px] uppercase">Automatic refresh</p>
            <Select
              value={String(autoRefresh)}
              onChange={(v) => setAutoRefresh(Number(v))}
              options={[
                { value: "0", label: "Off" },
                { value: "60", label: "Every minute" },
                { value: "300", label: "Every 5 minutes" },
                { value: "900", label: "Every 15 minutes" },
                { value: "3600", label: "Hourly" },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card title="Momence write-back" subtitle="Edits trigger a PUT to the Momence customer-leads endpoint">
        <div className="space-y-2.5 text-[12.5px]">
          <Status
            ok={!!momence?.configured}
            label={momence?.configured ? "MOMENCE_ALL_COOKIES credential detected" : "MOMENCE_ALL_COOKIES is not configured — edits stay local"}
          />
          <p className="text-muted">Host ID: <span className="num font-medium">{momence?.hostId ?? "—"}</span></p>
          <p className="text-muted">
            Endpoint: <code className="text-[11.5px]">PUT https://momence.com/_api/primary/host/&#123;hostId&#125;/customer-leads/&#123;leadId&#125;</code>
          </p>
          <p className="text-faint">
            Credentials are read server-side only and are never exposed to the browser. Single-record and bulk edits are both
            supported from the Lead Explorer.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {momence?.editableFields.map((f) => (
              <span key={f} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Appearance & preferences">
        <div className="space-y-3 text-[12.5px]">
          <div>
            <p className="text-faint mb-1 text-[11px] uppercase">Theme</p>
            <Select value={theme} onChange={(v) => setTheme(v as "light" | "dark")} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </div>
          <p className="text-faint">Filters, saved views, theme and refresh cadence persist in this browser.</p>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={13} /> Print / export dashboard as PDF</Button>
        </div>
      </Card>

      <Card title="Saved views">
        <div className="space-y-1.5">
          {savedViews.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-[12.5px]">
              <span>{v.name}</span>
              {v.id.startsWith("bi-") ? (
                <span className="text-faint text-[10.5px] uppercase">built-in</span>
              ) : (
                <Button variant="danger" size="sm" onClick={() => deleteView(v.id)}>Delete</Button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- Cadence editor ----------------------------- */
const FIELDS: { key: keyof CadenceConfig; label: string; hint: string }[] = [
  { key: "fu1FromCreate", label: "FU1 — days after lead creation", hint: "First touch SLA" },
  { key: "fu2Gap", label: "FU2 — days after FU1", hint: "Second follow-up gap" },
  { key: "fu3Gap", label: "FU3 — days after FU2", hint: "Third follow-up gap" },
  { key: "fu4Gap", label: "FU4 — days after FU3", hint: "Final follow-up gap" },
];

function CadenceEditor({ onSaved }: { onSaved: () => void }) {
  const [cfg, setCfg] = useState<CadenceConfig>(DEFAULT_CADENCE);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/settings/cadence")
      .then((r) => r.json())
      .then((j) => { if (j?.cadence) setCfg(j.cadence); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const set = (key: keyof CadenceConfig, v: string) => {
    const n = Number(v);
    setCfg((c) => ({ ...c, [key]: Number.isFinite(n) ? n : c[key] }));
    setDirty(true);
    setMsg(null);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/settings/cadence", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed");
      setCfg(j.cadence);
      invalidateCadence({ cadence: j.cadence, cumulative: j.cumulative });
      setMsg("Saved — all cadence metrics, badges and AI alerts now use the new rhythm.");
      setDirty(false);
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setCfg(DEFAULT_CADENCE);
    setDirty(true);
    setMsg(null);
  };

  // cumulative preview
  let acc = 0;
  const cumulative = [cfg.fu1FromCreate, cfg.fu2Gap, cfg.fu3Gap, cfg.fu4Gap].map((g) => (acc += Number(g) || 0));

  return (
    <Card
      title="Follow-up cadence"
      subtitle="Defines when each follow-up is due. Drives overdue/missed detection, table badges, risk scores and AI alerts."
      actions={<span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Timer size={15} /></span>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <p className="mb-1 text-[11.5px] font-medium">{f.label}</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={loaded ? cfg[f.key] : ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="num"
                />
                <span className="text-faint text-[11.5px] whitespace-nowrap">days</span>
              </div>
              <p className="text-faint mt-0.5 text-[10.5px]">{f.hint}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-1 text-[11.5px] font-medium">Mark as “missed” after</p>
          <Select
            value={String(cfg.missedThreshold)}
            onChange={(v) => { setCfg((c) => ({ ...c, missedThreshold: Number(v) })); setDirty(true); }}
            options={[
              { value: "1", label: "1 overdue step" },
              { value: "2", label: "2 overdue steps" },
              { value: "3", label: "3 overdue steps" },
              { value: "4", label: "4 overdue steps" },
            ]}
          />
        </div>

        {/* visual timeline preview */}
        <div className="rounded-xl border p-3.5" style={{ background: "var(--surface-2)" }}>
          <p className="text-faint mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
            <Clock size={11} /> Timeline preview (days from lead creation)
          </p>
          <div className="relative mx-1 flex items-center" style={{ height: 44 }}>
            <span className="absolute top-1/2 right-0 left-0 h-[3px] -translate-y-1/2 rounded-full" style={{ background: "var(--border-strong)" }} />
            <span className="relative z-10 flex flex-col items-center" style={{ marginRight: "auto" }}>
              <span className="h-3.5 w-3.5 rounded-full border-2" style={{ background: "var(--surface)", borderColor: "var(--text-faint)" }} />
              <span className="text-faint mt-1 text-[10px] font-medium">Day 0</span>
            </span>
            {cumulative.map((d, i) => (
              <span key={i} className="relative z-10 flex flex-col items-center" style={{ marginRight: i === 3 ? 0 : "auto" }}>
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9.5px] font-bold" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>{i + 1}</span>
                <span className="num mt-1 text-[10px] font-medium">D{d}</span>
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip tone="info">Full cycle: {cumulative[3]} days</Chip>
            <Chip tone="warning">Overdue when a step passes its due date</Chip>
            <Chip tone="critical">Missed after {cfg.missedThreshold} overdue step{cfg.missedThreshold === 1 ? "" : "s"}</Chip>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={resetDefaults}><RotateCcw size={13} /> Restore defaults</Button>
          <div className="flex items-center gap-3">
            {msg && <span className="max-w-[260px] truncate text-[11.5px]" style={{ color: msg.startsWith("Saved") ? "var(--positive)" : "var(--critical)" }}>{msg}</span>}
            <Button variant="primary" size="sm" onClick={save} disabled={saving || !dirty}>
              <Save size={13} /> {saving ? "Saving…" : "Save cadence"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
