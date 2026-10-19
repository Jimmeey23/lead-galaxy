"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FilterState } from "./types";

export const DEFAULT_FILTERS: FilterState = {
  dateDimension: "createdAt",
  preset: "All Time",
  compare: "previous",
  search: "",
  center: [],
  associate: [],
  sourceName: [],
  channel: [],
  stageName: [],
  status: [],
  trialStatus: [],
  conversionStatus: [],
  retentionStatus: [],
  classType: [],
  utmCampaign: [],
  utmSource: [],
  utmMedium: [],
  ltvMin: null,
  ltvMax: null,
  visitsMin: null,
  visitsMax: null,
  purchasesMin: null,
  followUpActivity: "any",
  advanced: { combinator: "AND", conditions: [] },
};

export type SavedView = {
  id: string;
  name: string;
  filters: FilterState;
  module?: string;
};

type Ctx = {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  patch: (p: Partial<FilterState>) => void;
  reset: () => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  savedViews: SavedView[];
  saveView: (name: string, module: string) => void;
  applyView: (v: SavedView) => void;
  deleteView: (id: string) => void;
  autoRefresh: number;
  setAutoRefresh: (n: number) => void;
  refreshKey: number;
  bumpRefresh: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

const BUILT_IN: SavedView[] = [
  { id: "bi-unconverted", name: "Unconverted leads", filters: { ...DEFAULT_FILTERS, conversionStatus: ["Not Converted"] } },
  { id: "bi-month", name: "This month's leads", filters: { ...DEFAULT_FILTERS, preset: "This Month" } },
  { id: "bi-highltv", name: "High-LTV customers", filters: { ...DEFAULT_FILTERS, ltvMin: 50000 } },
  { id: "bi-fu", name: "Follow-up gaps", filters: { ...DEFAULT_FILTERS, followUpActivity: "none" } },
  { id: "bi-trial", name: "Tried but not converted", filters: { ...DEFAULT_FILTERS, conversionStatus: ["Not Converted"], trialStatus: ["Trial Completed"] } },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [theme, setThemeState] = useState<"light" | "dark">("dark");
  const [savedViews, setSavedViews] = useState<SavedView[]>(BUILT_IN);
  const [autoRefresh, setAutoRefreshState] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    try {
      const t = (localStorage.getItem("p57.theme") as "light" | "dark") || "dark";
      setThemeState(t);
      const v = localStorage.getItem("p57.views");
      if (v) setSavedViews([...BUILT_IN, ...(JSON.parse(v) as SavedView[])]);
      const f = localStorage.getItem("p57.filters");
      if (f) setFilters({ ...DEFAULT_FILTERS, ...(JSON.parse(f) as FilterState) });
      const a = localStorage.getItem("p57.autoRefresh");
      if (a) setAutoRefreshState(Number(a));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem("p57.filters", JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => setRefreshKey((k) => k + 1), autoRefresh * 1000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  const setTheme = useCallback((t: "light" | "dark") => {
    setThemeState(t);
    localStorage.setItem("p57.theme", t);
  }, []);

  const setAutoRefresh = useCallback((n: number) => {
    setAutoRefreshState(n);
    localStorage.setItem("p57.autoRefresh", String(n));
  }, []);

  const persistViews = (views: SavedView[]) => {
    setSavedViews(views);
    localStorage.setItem(
      "p57.views",
      JSON.stringify(views.filter((v) => !v.id.startsWith("bi-"))),
    );
  };

  const value: Ctx = useMemo(
    () => ({
      filters,
      setFilters,
      patch: (p) => setFilters((f) => ({ ...f, ...p })),
      reset: () => setFilters(DEFAULT_FILTERS),
      theme,
      setTheme,
      savedViews,
      saveView: (name, module) =>
        persistViews([
          ...savedViews,
          { id: `v-${Date.now()}`, name, filters, module },
        ]),
      applyView: (v) => setFilters({ ...DEFAULT_FILTERS, ...v.filters }),
      deleteView: (id) => persistViews(savedViews.filter((v) => v.id !== id)),
      autoRefresh,
      setAutoRefresh,
      refreshKey,
      bumpRefresh: () => setRefreshKey((k) => k + 1),
    }),
    [filters, theme, savedViews, autoRefresh, refreshKey, setTheme, setAutoRefresh],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

/* --------------------------- cadence config hook -------------------------- */
import { DEFAULT_CADENCE, cadenceCumulative, type CadenceConfig } from "./cadence-config";

let cadenceCache: { cadence: CadenceConfig; cumulative: number[] } | null = null;
const cadenceListeners = new Set<() => void>();

export function invalidateCadence(next?: { cadence: CadenceConfig; cumulative: number[] }) {
  cadenceCache = next ?? null;
  cadenceListeners.forEach((fn) => fn());
}

export function useCadenceConfig() {
  const [state, setState] = useState<{ cadence: CadenceConfig; cumulative: number[] }>(
    cadenceCache ?? { cadence: DEFAULT_CADENCE, cumulative: cadenceCumulative(DEFAULT_CADENCE) },
  );
  useEffect(() => {
    const sync = () => {
      if (cadenceCache) setState(cadenceCache);
      else
        fetch("/api/settings/cadence")
          .then((r) => r.json())
          .then((j) => {
            if (j?.cadence) {
              cadenceCache = { cadence: j.cadence, cumulative: j.cumulative };
              setState(cadenceCache);
            }
          })
          .catch(() => {});
    };
    cadenceListeners.add(sync);
    if (!cadenceCache) sync();
    return () => {
      cadenceListeners.delete(sync);
    };
  }, []);
  return state;
}

/* --------------------------- data fetching hook --------------------------- */
export function usePost<T>(url: string, body: unknown, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(body);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: key,
    })
      .then(async (r) => {
        const ct = r.headers.get("content-type") || "";
        let j: unknown;
        if (ct.includes("application/json")) j = await r.json();
        else {
          const txt = await r.text();
          try { j = JSON.parse(txt); } catch { throw new Error(txt.slice(0, 300).replace(/<[^>]*>/g, " ").trim() || `Request failed (${r.status})`); }
        }
        if (!r.ok) throw new Error((j as { error?: string })?.error || `Request failed (${r.status})`);
        return j as T;
      })
      .then((j) => {
        if (!cancelled) {
          setData(j);
          setError(null);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, ...deps]);
  return { data, loading, error };
}
