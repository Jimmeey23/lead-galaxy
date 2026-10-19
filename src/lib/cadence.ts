import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_CADENCE, type CadenceConfig } from "./cadence-config";

export { DEFAULT_CADENCE, cadenceGaps, cadenceCumulative } from "./cadence-config";
export type { CadenceConfig } from "./cadence-config";

type CacheSlot = { value: CadenceConfig; at: number } | null;
const g = globalThis as unknown as { __cadenceCache?: CacheSlot };

function sanitise(v: Partial<CadenceConfig> | null | undefined): CadenceConfig {
  const n = (x: unknown, d: number, lo = 1, hi = 60) => {
    const num = Number(x);
    return Number.isFinite(num) ? Math.min(hi, Math.max(lo, Math.round(num))) : d;
  };
  return {
    fu1FromCreate: n(v?.fu1FromCreate, DEFAULT_CADENCE.fu1FromCreate),
    fu2Gap: n(v?.fu2Gap, DEFAULT_CADENCE.fu2Gap),
    fu3Gap: n(v?.fu3Gap, DEFAULT_CADENCE.fu3Gap),
    fu4Gap: n(v?.fu4Gap, DEFAULT_CADENCE.fu4Gap),
    missedThreshold: n(v?.missedThreshold, DEFAULT_CADENCE.missedThreshold, 1, 4),
  };
}

export async function getCadence(): Promise<CadenceConfig> {
  const cached = g.__cadenceCache;
  if (cached && Date.now() - cached.at < 30_000) return cached.value;
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "cadence"));
    const value = sanitise(rows[0]?.value as Partial<CadenceConfig> | undefined);
    g.__cadenceCache = { value, at: Date.now() };
    return value;
  } catch {
    return cached?.value ?? DEFAULT_CADENCE;
  }
}

export async function setCadence(input: Partial<CadenceConfig>): Promise<CadenceConfig> {
  const value = sanitise(input);
  await db
    .insert(appSettings)
    .values({ key: "cadence", value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  g.__cadenceCache = { value, at: Date.now() };
  return value;
}
