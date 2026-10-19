/** Client-safe cadence config types & helpers (no DB imports). */

export type CadenceConfig = {
  /** Days from lead creation until FU1 is due */
  fu1FromCreate: number;
  /** Days after FU1 until FU2 is due */
  fu2Gap: number;
  /** Days after FU2 until FU3 is due */
  fu3Gap: number;
  /** Days after FU3 until FU4 is due */
  fu4Gap: number;
  /** Number of overdue steps before a lead counts as "missed" */
  missedThreshold: number;
};

export const DEFAULT_CADENCE: CadenceConfig = {
  fu1FromCreate: 2,
  fu2Gap: 3,
  fu3Gap: 5,
  fu4Gap: 7,
  missedThreshold: 2,
};

export const cadenceGaps = (c: CadenceConfig): number[] => [c.fu1FromCreate, c.fu2Gap, c.fu3Gap, c.fu4Gap];

/** Cumulative days from creation for each FU step (used for quick client badges) */
export const cadenceCumulative = (c: CadenceConfig): number[] => {
  const gaps = cadenceGaps(c);
  const out: number[] = [];
  let acc = 0;
  for (const gap of gaps) {
    acc += gap;
    out.push(acc);
  }
  return out;
};
