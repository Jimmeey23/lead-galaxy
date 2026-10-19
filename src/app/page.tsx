"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  ChevronLeft,
  Database,
  GitBranch,
  Lightbulb,
  Megaphone,
  PanelsTopLeft,
  PhoneCall,
  Settings2,
  ShieldCheck,
  Table2,
  Users,
  Wallet,
} from "lucide-react";
import { AppProvider, useApp, usePost } from "@/lib/store";
import { TopBar } from "@/components/filter-bar";
import { LeadExplorer } from "@/components/explorer";
import {
  Analytics,
  DimensionModule,
  FollowUpModule,
  FunnelModule,
  LifecycleModule,
  Loading,
  Overview,
  QualityModule,
  RevenueModule,
} from "@/components/modules";
import { AIView } from "@/components/ai-view";
import { SettingsModule } from "@/components/settings";
import { LeadDrawer } from "@/components/lead-drawer";
import { Card, EmptyState, Button } from "@/components/ui";
import { cx } from "@/lib/format";
import type { FilterState } from "@/lib/types";

const NAV = [
  { id: "overview", label: "Overview", icon: PanelsTopLeft, group: "Executive", subtitle: "Executive performance pulse" },
  { id: "ai", label: "AI Intelligence", icon: Bot, group: "Executive", subtitle: "Missed FU, opportunities & anomalies" },
  { id: "insights", label: "Insights", icon: Lightbulb, group: "Executive", subtitle: "Computed business opportunities" },
  { id: "explorer", label: "Lead Explorer", icon: Table2, group: "Data", subtitle: "Master lead table — inline FU editing" },
  { id: "funnel", label: "Funnel Analytics", icon: GitBranch, group: "Performance", subtitle: "Progression & leakage" },
  { id: "associate", label: "Associate", icon: Users, group: "Performance", subtitle: "Team performance" },
  { id: "center", label: "Studios", icon: Building2, group: "Performance", subtitle: "Centre performance" },
  { id: "source", label: "Sources", icon: BarChart3, group: "Acquisition", subtitle: "Channel effectiveness" },
  { id: "campaign", label: "Campaigns", icon: Megaphone, group: "Acquisition", subtitle: "UTM & campaign" },
  { id: "followup", label: "Follow-ups", icon: PhoneCall, group: "Operations", subtitle: "Cadence & attention" },
  { id: "revenue", label: "Revenue", icon: Wallet, group: "Operations", subtitle: "Sales-truth revenue" },
  { id: "lifecycle", label: "Lifecycle", icon: Activity, group: "Operations", subtitle: "Trial & retention" },
  { id: "quality", label: "Data Quality", icon: ShieldCheck, group: "System", subtitle: "Health & cross-sheet flags" },
  { id: "settings", label: "Settings", icon: Settings2, group: "System", subtitle: "Integrations & prefs" },
];

function Shell() {
  const { filters, patch, refreshKey, bumpRefresh } = useApp();
  const [module, setModule] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [aiLeadId, setAiLeadId] = useState<string | null>(null);

  const [granularity, setGranularity] = useState("month");
  const body = useMemo(() => ({ filters, granularity }), [filters, granularity]);
  const { data, loading, error } = usePost<Analytics>("/api/analytics", body, [refreshKey]);

  const active = NAV.find((n) => n.id === module)!;
  const groups = [...new Set(NAV.map((n) => n.group))];

  const refresh = async () => {
    setSyncing(true);
    await fetch("/api/sync", { method: "POST" }).catch(() => {});
    bumpRefresh();
    setSyncing(false);
  };

  const drill = (p: Partial<FilterState>) => {
    patch(p);
    setModule("explorer");
  };

  // resolve lead for drawer from data when aiLeadId is set
  const drawerLead = useMemo(() => {
    if (!aiLeadId || !data) return null;
    // we don't have full lead list in analytics payload, so fetch via leads API? We'll lazy fetch when drawer opens
    return null;
  }, [aiLeadId, data]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <aside
        className={cx("no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r md:flex", collapsed ? "w-[64px]" : "w-[260px]")}
        style={{ background: "var(--sidebar)" }}
      >
        <div className="flex items-center gap-3 px-4 py-5">
          <span className="brand-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
            <svg viewBox="0 0 40 40" width="34" height="34" role="img" aria-label="Lead Galaxy">
              <ellipse cx="20" cy="20" rx="17" ry="8" transform="rotate(-35 20 20)" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <ellipse cx="20" cy="20" rx="10" ry="16" transform="rotate(-35 20 20)" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".45" />
              <circle cx="20" cy="20" r="5" fill="currentColor" />
              <circle cx="33" cy="11" r="3" fill="currentColor" />
              <path d="M9 5v6M6 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="display truncate text-[13.5px] font-semibold leading-tight">Lead Galaxy</p>
              <p className="text-faint text-[11px] leading-tight">Physique 57 India · Intelligence</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-auto px-2 pb-3">
          {groups.map((g) => (
            <div key={g} className="mb-3">
              {!collapsed && <p className="text-faint px-2.5 pb-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase">{g}</p>}
              {NAV.filter((n) => n.group === g).map((n) => {
                const Icon = n.icon;
                const on = module === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setModule(n.id)}
                    title={n.label}
                    className={cx(
                      "focus-ring mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px] transition-all",
                      on ? "nav-active font-semibold" : "text-muted hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
                    )}
                    style={on ? { background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
                  >
                    <Icon size={15} className="shrink-0" />
                    {!collapsed && <span className="truncate">{n.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t p-3">
          {!collapsed && data?.meta.crossSheet && (
            <div className="rounded-xl border px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
              <p className="text-[11px] font-semibold">Cross-sheet live</p>
              <p className="text-faint text-[11px] leading-snug">{data.meta.crossSheet.enrichedLeads.toLocaleString()} enriched · {data.meta.crossSheet.salesRows.toLocaleString()} sales</p>
            </div>
          )}
          <button onClick={() => setCollapsed((c) => !c)} className="text-faint mt-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-[11.5px] hover:text-[var(--text)]">
            <ChevronLeft size={14} className={collapsed ? "rotate-180" : ""} />
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <TopBar
          title={active.label}
          subtitle={active.subtitle}
          facets={data?.facets ?? {}}
          syncedAt={data?.meta.syncedAt ?? null}
          filteredRows={data?.meta.filteredRows ?? 0}
          totalRows={data?.meta.totalRows ?? 0}
          onRefresh={refresh}
          refreshing={syncing}
        />

        <div className="no-print flex gap-1 overflow-auto border-b px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setModule(n.id)} className="rounded-full px-3 py-1.5 text-[12px] whitespace-nowrap" style={module === n.id ? { background: "var(--accent)", color: "var(--accent-contrast)" } : { color: "var(--text-muted)", background: "var(--surface)" }}>
              {n.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          {error && <Card><EmptyState title="Unable to load the lead dataset" description={error} icon={<Database size={18} />} action={<Button variant="primary" size="sm" className="mt-3" onClick={refresh}>Retry sync</Button>} /></Card>}
          {data?.meta.error && <div role="alert" className="mb-4 rounded-xl border p-3 text-sm" style={{ color: "var(--warning)", background: "var(--warning-soft)" }}>{data.meta.error}</div>}
          {!data && loading && <Loading />}
          {data && (
            <>
              {module === "overview" && <Overview a={data} gran={granularity} setGran={setGranularity} drill={drill} goExplorer={() => setModule("explorer")} />}
              {module === "ai" && <AIView a={data} drill={drill} onOpenLead={(id) => {
                // open lead drawer by fetching lead detail via API (we'll reuse LeadDrawer's data via analytics? quick fetch)
                // we can fetch lead row via /api/leads and open drawer
                fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filters, page: 1, pageSize: 50, columnFilters: { id } }) })
                  .then((r) => r.json())
                  .then((j) => { if (j.rows?.[0]) { const evt = new CustomEvent("openLead", { detail: j.rows[0] }); window.dispatchEvent(evt); } });
              }} />}
              {module === "insights" && (
                <div className="space-y-4">
                  {data.ai && <AIView a={data} drill={drill} />}
                </div>
              )}
              {module === "explorer" && <LeadExplorer />}
              {module === "funnel" && <FunnelModule a={data} drill={drill} />}
              {module === "associate" && <DimensionModule a={data} title="Associate performance" dimensionKey="associate" label="Associate" drill={drill} />}
              {module === "center" && <DimensionModule a={data} title="Centre performance" dimensionKey="center" label="Centre" drill={drill} />}
              {module === "source" && <DimensionModule a={data} title="Source & platform performance" dimensionKey="sourceName" label="Source" drill={drill} extra={<div className="grid gap-4 lg:grid-cols-2"><Card title="Channel performance"><SmallMatrix rows={data.groups.channel} onDrill={(k) => drill({ channel: [k] })} /></Card><Card title="UTM source performance"><SmallMatrix rows={data.groups.utmSource} onDrill={(k) => drill({ utmSource: [k] })} /></Card></div>} />}
              {module === "campaign" && <DimensionModule a={data} title="Campaign intelligence" dimensionKey="utmCampaign" label="Campaign" drill={drill} extra={<div className="grid gap-4 lg:grid-cols-2"><Card title="UTM medium"><SmallMatrix rows={data.groups.utmMedium} onDrill={(k) => drill({ utmMedium: [k] })} /></Card><Card title="UTM content"><SmallMatrix rows={data.groups.utmContent} /></Card><Card title="UTM term"><SmallMatrix rows={data.groups.utmTerm} /></Card><Card title="Channel → campaign contribution"><SmallMatrix rows={data.groups.channel} onDrill={(k) => drill({ channel: [k] })} /></Card></div>} />}
              {module === "followup" && <FollowUpModule a={data} drill={drill} />}
              {module === "revenue" && <RevenueModule a={data} drill={drill} />}
              {module === "lifecycle" && <LifecycleModule a={data} drill={drill} />}
              {module === "quality" && <QualityModule a={data} />}
              {module === "settings" && <SettingsModule a={data} onRefresh={refresh} />}
            </>
          )}
        </div>
      </main>

      <LeadQuickOpen />
    </div>
  );
}

function LeadQuickOpen() {
  const [lead, setLead] = React.useState<import("@/lib/types").Lead | null>(null);
  const { bumpRefresh } = useApp();
  React.useEffect(() => {
    const h = (e: Event) => setLead((e as CustomEvent).detail as import("@/lib/types").Lead);
    window.addEventListener("openLead", h as EventListener);
    return () => window.removeEventListener("openLead", h as EventListener);
  }, []);
  return <LeadDrawer lead={lead} onClose={() => setLead(null)} onSaved={bumpRefresh} />;
}

function SmallMatrix({ rows, onDrill }: { rows: { key: string; leads: number; converted: number; conversionRate: number; ltv: number }[]; onDrill?: (k: string) => void }) {
  return (
    <div className="max-h-[320px] overflow-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0" style={{ background: "var(--surface)" }}>
          <tr className="text-faint text-[10.5px] uppercase"><th className="py-1.5 text-left">Key</th><th className="py-1.5 text-right">Leads</th><th className="py-1.5 text-right">Conv.</th><th className="py-1.5 text-right">Rate</th><th className="py-1.5 text-right">LTV</th></tr>
        </thead>
        <tbody>
          {rows.slice(0, 40).map((r) => (
            <tr key={r.key} className={cx("border-t", onDrill && "cursor-pointer hover:bg-[var(--surface-2)]")} onClick={() => onDrill?.(r.key)}>
              <td className="max-w-[180px] truncate py-1.5 pr-2">{r.key}</td>
              <td className="num py-1.5 text-right">{r.leads.toLocaleString()}</td>
              <td className="num py-1.5 text-right">{r.converted.toLocaleString()}</td>
              <td className="num py-1.5 text-right">{r.conversionRate.toFixed(1)}%</td>
              <td className="num py-1.5 text-right">₹{Math.round(r.ltv).toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
