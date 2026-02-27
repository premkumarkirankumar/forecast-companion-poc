import { MONTHS } from "../../data/hub";
import { clampPct } from "./format";

export function distributeEvenly(total, lockedByMonth) {
  const lockedSum = MONTHS.reduce((a, m) => a + (lockedByMonth[m] ?? 0), 0);
  const remaining = Math.max(0, total - lockedSum);

  const unlockedMonths = MONTHS.filter((m) => lockedByMonth[m] === undefined);
  const per = unlockedMonths.length ? remaining / unlockedMonths.length : 0;

  const out = {};
  for (const m of MONTHS) {
    out[m] = lockedByMonth[m] === undefined ? per : lockedByMonth[m];
  }
  return out;
}

export function normalizeSplit(msPct, nfPct) {
  const ms = clampPct(msPct);
  const nf = clampPct(nfPct);
  const s = ms + nf;
  if (s === 0) return { msPct: 0, nfPct: 0 };
  const msN = Math.round((ms / s) * 100);
  return { msPct: msN, nfPct: 100 - msN };
}

/**
 * Generic rollup for any item list that has:
 * - msByMonth: { Jan: number, ... }
 * - nfByMonth: { Jan: number, ... }
 */
export function computeRollup(items) {
  const msByMonth = Object.fromEntries(MONTHS.map((m) => [m, 0]));
  const nfByMonth = Object.fromEntries(MONTHS.map((m) => [m, 0]));

  for (const it of items || []) {
    for (const m of MONTHS) {
      msByMonth[m] += it.msByMonth?.[m] ?? 0;
      nfByMonth[m] += it.nfByMonth?.[m] ?? 0;
    }
  }

  return { msByMonth, nfByMonth };
}

// Backwards compatibility (if you used this name elsewhere)
export function computeContractorRollup(contractors) {
  return computeRollup(contractors);
}