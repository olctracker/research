// Formulas worked out from the crew's data. Raw observations always win; formulas fill gaps
// and flag reports that disagree.
//
// Character: the XP target shown at LVL L (the number after "/", i.e. the XP to reach L+1)
//   = ceil(230 × (L+1)^1.3544). Matches every value seen: LVL 1 (589, a fresh account),
//   24–27, 29, 30 (R3). Status: verified.
//
// Upgrade XP for reaching level L (store, and Keygen keys land on the same XP):
//   floor(0.2 × ceil(ceil(base × L^1.25) × 0.85 for defensive))  — the store-price recipe with L^1.25.
//   Verified on 70 of 70 reports (16 store + 55 one-level keys, 11 programs, R2 and R3).
//   A key that jumps several levels gives only the landing level's XP (Password Cracker 2 → 4 = +1,244 = Lv 4 XP).
// Hardware XP: Device = 25% of its price (4 of 4), Network = 20% (10 of 10), Botnet ≈ price ÷ 6 (2 points, likely).

export type FormulaStatus = "verified" | "likely";

export const CHAR_FORMULA = { status: "verified" as FormulaStatus, text: "ceil(230 × (LVL+1)^1.3544)" };

/** XP target shown at character level `level` (to reach level+1). */
export function charTarget(level: number): number | null {
  if (!Number.isInteger(level) || level < 1) return null;
  return Math.ceil(230 * Math.pow(level + 1, 1.3544));
}

/** Predicted software XP for reaching `toLevel` (store or key), or null when there's no formula. */
export function predictedStoreXp(upgradeId: string, toLevel: number): { value: number; status: FormulaStatus } | null {
  const v = formulaXp(upgradeId, toLevel);
  return v === null ? null : { value: v, status: "verified" };
}

/** Hardware XP from its store price: Device 25%, Network 20% (verified), Botnet ÷ 6 (likely). */
export function hardwareXp(upgradeId: string, price: number): { value: number; status: FormulaStatus } | null {
  if (upgradeId === "device") return { value: Math.round(price * 0.25), status: "verified" };
  if (upgradeId === "network") return { value: Math.round(price * 0.2), status: "verified" };
  if (upgradeId === "botnet") return { value: Math.floor(price / 6), status: "likely" };
  return null;
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

/** XP for reaching level L: floor(0.2 × ceil(ceil(base × L^1.25) × discount)). Verified 70/70. */
export function formulaXp(upgradeId: string, level: number): number | null {
  const b = BASE_PRICE[upgradeId];
  if (b === undefined || level < 1) return null;
  const a = Math.ceil(b * Math.pow(level, 1.25));
  const d = DEFENSIVE.has(upgradeId) ? Math.ceil(a * 0.85) : a;
  return Math.floor(d * 0.2);
}

/**
 * (Superseded by formulaXp.) Old guesses for store XP of programs other than Firewall, built from Firewall (136 = 800 × 0.2 × 0.85):
 * floor(0.2 × base × discount × L^1.25). "defensive" = the 0.85 only for defensive programs; "all" = 0.85 for everyone.
 */
export function guessStoreXp(upgradeId: string, level: number): { defensiveOnly: number; all: number } | null {
  const b = BASE_PRICE[upgradeId];
  if (b === undefined || level < 1) return null;
  const raw = (d: number) => Math.floor(0.2 * b * d * Math.pow(level, 1.25));
  return { defensiveOnly: raw(DEFENSIVE.has(upgradeId) ? 0.85 : 1), all: raw(0.85) };
}
