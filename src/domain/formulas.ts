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

// ---------------------------------------------------------------- prices (verified on 17 store + 18 key prices)

/** Level-1 store price before any discount. Hardware (Device / Network / Botnet) uses fixed tables instead. */
export const BASE_PRICE: Record<string, number> = {
  firewall: 800, bypasser: 800, password_encryptor: 1100, password_cracker: 1100, antivirus: 1000,
  proxy: 900, trace: 900, spam: 1800, siphon: 1600, rootkit: 1400, keygen: 600
};
export const DEFENSIVE = new Set(["firewall", "password_encryptor", "antivirus", "proxy", "trace"]);

/** Store price to reach level L: ceil(base × L^1.3), then ceil(× 0.85) for defensive programs. */
export function formulaStorePrice(upgradeId: string, level: number): number | null {
  const b = BASE_PRICE[upgradeId];
  if (b === undefined || level < 1) return null;
  const p = Math.ceil(b * Math.pow(level, 1.3));
  return DEFENSIVE.has(upgradeId) ? Math.ceil(p * 0.85) : p;
}

/** Keygen key price for a jump: ceil(store(to) × 0.5 × min(1, 0.3 + 0.7 × (jump − 1) / 19)). */
export function formulaKeyPrice(upgradeId: string, fromLevel: number, toLevel: number): number | null {
  const s = formulaStorePrice(upgradeId, toLevel);
  const jump = toLevel - fromLevel;
  if (s === null || jump < 1) return null;
  return Math.ceil(s * 0.5 * Math.min(1, 0.3 + (0.7 * (jump - 1)) / 19));
}

/**
 * Untested guesses for store XP of programs other than Firewall, built from Firewall (136 = 800 × 0.2 × 0.85):
 * floor(0.2 × base × discount × L^1.25). "defensive" = the 0.85 only for defensive programs; "all" = 0.85 for everyone.
 */
export function guessStoreXp(upgradeId: string, level: number): { defensiveOnly: number; all: number } | null {
  const b = BASE_PRICE[upgradeId];
  if (b === undefined || level < 1) return null;
  const raw = (d: number) => Math.floor(0.2 * b * d * Math.pow(level, 1.25));
  return { defensiveOnly: raw(DEFENSIVE.has(upgradeId) ? 0.85 : 1), all: raw(0.85) };
}
