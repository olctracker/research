// Formulas worked out from the crew's data. Raw observations always win; formulas fill gaps
// and flag reports that disagree.
//
// Character: the XP target shown at LVL L (the number after "/", i.e. the XP to reach L+1)
//   = ceil(230 × (L+1)^1.3544). Matches every value seen: LVL 1 (589, a fresh account),
//   24–27, 29, 30 (R3). Status: verified.
//
// Upgrade XP (store), per level L:
//   Firewall = floor(136 × L^1.25) — matches L24–26 and predicted L27 (8,370) before it was bought. Status: verified
//   (136 = base price 800 × 0.2 × 0.85 defensive discount; other programs not confirmed yet).

export type FormulaStatus = "verified" | "likely";

export const CHAR_FORMULA = { status: "verified" as FormulaStatus, text: "ceil(230 × (LVL+1)^1.3544)" };

/** XP target shown at character level `level` (to reach level+1). */
export function charTarget(level: number): number | null {
  if (!Number.isInteger(level) || level < 1) return null;
  return Math.ceil(230 * Math.pow(level + 1, 1.3544));
}

interface XpFormula { status: FormulaStatus; text: string; fn: (toLevel: number) => number }

export const XP_FORMULAS: Record<string, XpFormula> = {
  firewall: { status: "verified", text: "floor(136 × L^1.25)", fn: (l) => Math.floor(136 * Math.pow(l, 1.25)) }
};

/** Predicted store XP for reaching `toLevel`, or null when there's no formula yet. */
export function predictedStoreXp(upgradeId: string, toLevel: number): { value: number; status: FormulaStatus } | null {
  const f = XP_FORMULAS[upgradeId];
  if (!f || toLevel < 1) return null;
  return { value: f.fn(toLevel), status: f.status };
}
