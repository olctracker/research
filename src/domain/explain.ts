// Explains a reported number: does it match the formula, and if not, what does it match instead?
// Helps the admin see "2,464 is a Password Cracker key price — wrong program picked?".

import { CATALOG, getEntry } from "./catalog";
import { charTarget, formulaKeyPrice, formulaStorePrice, predictedStoreXp } from "./formulas";
import type { ExpObservation, LevelRequirementObservation, PriceObservation } from "./types";

export interface Explanation {
  /** true = matches the formula, false = doesn't, null = no formula for this yet */
  matches: boolean | null;
  formula: number | null;
  /** What this exact number would be instead (wrong program / wrong level), if anything. */
  lookalike: string | null;
}

type Row = PriceObservation | ExpObservation | LevelRequirementObservation;
const SOFTWARE = CATALOG.filter((e) => e.kind === "level" && e.download);
const n = (v: number) => v.toLocaleString("en-US");

export function explain(r: Row): Explanation {
  if ("expRequired" in r) {
    const f = charTarget(r.level);
    let lookalike: string | null = null;
    if (f !== r.expRequired) {
      for (let d = 1; d <= 3 && !lookalike; d++) for (const l of [r.level - d, r.level + d]) {
        if (l >= 1 && charTarget(l) === r.expRequired) { lookalike = `the target shown at LVL ${l}. Level entered ${d} off?`; break; }
      }
    }
    return { matches: f === null ? null : f === r.expRequired, formula: f, lookalike };
  }
  if ("cost" in r) {
    const v = r.cost;
    if (r.method === "download" && r.costType === "combined") {
      const f = formulaKeyPrice(r.upgradeId, r.fromLevel, r.toLevel);
      let lookalike: string | null = null;
      if (f !== v) {
        const other = SOFTWARE.find((e) => e.id !== r.upgradeId && formulaKeyPrice(e.id, r.fromLevel, r.toLevel) === v);
        if (other) lookalike = `a ${other.name} key from ${r.fromLevel} → ${r.toLevel}. Wrong program picked?`;
        for (let a = 0; a <= r.toLevel + 10 && !lookalike; a++) for (let b = a + 1; b <= r.toLevel + 10; b++) {
          if ((a !== r.fromLevel || b !== r.toLevel) && formulaKeyPrice(r.upgradeId, a, b) === v) { lookalike = `a ${getEntry(r.upgradeId).name} key from ${a} → ${b}. Levels entered wrong?`; break; }
        }
        if (!lookalike) {
          const st = SOFTWARE.find((e) => formulaStorePrice(e.id, r.toLevel) === v);
          if (st) lookalike = `the ${st.name} store price for Lv ${r.toLevel}. Recorded as Keygen by mistake?`;
        }
      }
      return { matches: f === null ? null : f === v, formula: f, lookalike };
    }
    if (r.method === "store" && r.costType === "per_level") {
      const f = formulaStorePrice(r.upgradeId, r.toLevel);
      let lookalike: string | null = null;
      if (f !== null && f !== v) {
        const other = SOFTWARE.find((e) => e.id !== r.upgradeId && formulaStorePrice(e.id, r.toLevel) === v);
        if (other) lookalike = `the ${other.name} store price for Lv ${r.toLevel}. Wrong program picked?`;
        for (let d = 1; d <= 3 && !lookalike; d++) for (const l of [r.toLevel - d, r.toLevel + d]) {
          if (l >= 1 && formulaStorePrice(r.upgradeId, l) === v) { lookalike = `the ${getEntry(r.upgradeId).name} store price for Lv ${l}. Level entered ${d} off?`; break; }
        }
      }
      return { matches: f === null ? null : f === v, formula: f, lookalike };
    }
    return { matches: null, formula: null, lookalike: null };
  }
  // XP (store per level, or a key: same XP as the level it lands on)
  if ((r.method === "store" && r.expBasis === "per_level") || r.method === "download") {
    const p = predictedStoreXp(r.upgradeId, r.toLevel);
    let lookalike: string | null = null;
    if (p && p.value !== r.exp) {
      const other = SOFTWARE.find((e) => e.id !== r.upgradeId && predictedStoreXp(e.id, r.toLevel)?.value === r.exp);
      if (other) lookalike = `${other.name}'s XP for Lv ${r.toLevel}. Wrong program picked?`;
      for (let d = 1; d <= 3 && !lookalike; d++) for (const l of [r.toLevel - d, r.toLevel + d]) {
        if (l >= 1 && predictedStoreXp(r.upgradeId, l)?.value === r.exp) { lookalike = `the XP for Lv ${l}. Level entered ${d} off?`; break; }
      }
    }
    return { matches: p ? p.value === r.exp : null, formula: p?.value ?? null, lookalike };
  }
  return { matches: null, formula: null, lookalike: null };
}

export const explainText = (e: Explanation) =>
  e.matches === true ? "Matches the formula" : e.matches === false ? `Formula says ${n(e.formula!)}` : null;
