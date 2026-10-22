// Upgrade calculator: what a set of upgrades costs, how much XP it gives, and where that leaves your character.
// Uses real reports first, then the verified formulas, so every number shown is either seen in game or proven.

import { getEntry } from "./catalog";
import { addXp } from "./exp";
import { formulaKeyPrice, formulaStorePrice, hardwareXp, predictedStoreXp } from "./formulas";
import { Knowledge } from "./knowledge";
import type { CharacterState } from "./types";

export type BuyMethod = "store" | "key";

export interface Option {
  /** Crypto, or null when part of it is unknown */
  cost: number | null;
  xp: number | null;
  /** Levels whose price or XP nobody knows yet */
  unknown: string[];
}

export interface PlanRow {
  upgradeId: string;
  from: number;
  to: number;
  store: Option;
  /** null when this can't be downloaded (hardware, Keygen itself, one-time items) */
  key: (Option & { keygenNeeded: number; keyXpUntested: boolean }) | null;
  /** One single-level key per level (from→from+1, …). Same XP as the store. null when it can't be downloaded. */
  singleKeys: Option | null;
}

/** Price of one store level: what players saw, otherwise the formula / hardware table. */
function storeLevelPrice(kb: Knowledge, id: string, level: number): number | null {
  const e = getEntry(id);
  if (e.kind === "one_time") return kb.oneTimeItemPrice(id).value;
  return kb.storeLevelPrice(id, level).value ?? formulaStorePrice(id, level);
}

/** XP of one store level: what players saw, otherwise the formula. */
function storeLevelXp(kb: Knowledge, id: string, level: number): number | null {
  const e = getEntry(id);
  if (e.kind === "one_time") return kb.oneTimeItemExp(id).value;
  const l = kb.storeLevelExp(id, level);
  if (l.value !== null) return l.value;
  if (l.predicted != null) return l.predicted;
  const price = storeLevelPrice(kb, id, level);
  return price !== null ? hardwareXp(id, price)?.value ?? null : null;
}

export function planRow(kb: Knowledge, upgradeId: string, from: number, to: number): PlanRow {
  const e = getEntry(upgradeId);
  const unknown: string[] = [];
  let cost: number | null = 0;
  let xp: number | null = 0;
  for (let l = from + 1; l <= to; l++) {
    const p = storeLevelPrice(kb, upgradeId, l);
    const x = storeLevelXp(kb, upgradeId, l);
    const tag = e.kind === "one_time" ? e.name : `${e.name} Lv ${l}`;
    if (p === null) { cost = null; unknown.push(`${tag} price`); } else if (cost !== null) cost += p;
    if (x === null) { xp = null; unknown.push(`${tag} XP`); } else if (xp !== null) xp += x;
  }
  const store: Option = { cost, xp, unknown };

  let key: PlanRow["key"] = null;
  if (e.download && to > from) {
    // A key jumps straight to the target. Prefer a price someone saw, otherwise the verified formula.
    const seen = kb.downloadCombinedPrice(upgradeId, from, to).value;
    const kc = seen ?? formulaKeyPrice(upgradeId, from, to);
    const seenXp = kb.downloadExp(upgradeId, to);
    const kx = seenXp.value ?? seenXp.predicted ?? predictedStoreXp(upgradeId, to)?.value ?? null;
    const ku: string[] = [];
    if (kc === null) ku.push(`${e.name} key ${from}→${to} price`);
    if (kx === null) ku.push(`${e.name} key ${from}→${to} XP`);
    key = { cost: kc, xp: kx, unknown: ku, keygenNeeded: to, keyXpUntested: to - from >= 2 };
  }
  let singleKeys: Option | null = null;
  if (e.download && to > from) {
    let sc: number | null = 0;
    const su: string[] = [];
    for (let l = from + 1; l <= to; l++) {
      const p = kb.downloadCombinedPrice(upgradeId, l - 1, l).value ?? formulaKeyPrice(upgradeId, l - 1, l);
      if (p === null) { sc = null; su.push(`${e.name} key ${l - 1}→${l} price`); } else if (sc !== null) sc += p;
    }
    singleKeys = { cost: sc, xp: store.xp, unknown: su };
  }
  return { upgradeId, from, to, store, key, singleKeys };
}

export interface PlanTotals {
  cost: number | null;
  xp: number | null;
  /** cost and xp are lower bounds when something is unknown */
  partial: boolean;
  after: { level: number; exp: number; required: number | null; levelsGained: number } | null;
  keygenShort: { upgradeId: string; needs: number }[];
}

export function planTotals(
  kb: Knowledge, rows: PlanRow[], choice: Record<string, BuyMethod>, character: CharacterState, keygenLevel: number
): PlanTotals {
  let cost = 0, xp = 0, partial = false;
  const keygenShort: PlanTotals["keygenShort"] = [];
  for (const r of rows) {
    if (r.to <= r.from) continue;
    const useKey = choice[r.upgradeId] === "key" && r.key;
    const o = useKey ? r.key! : r.store;
    if (o.cost === null) partial = true; else cost += o.cost;
    if (o.xp === null) partial = true; else xp += o.xp;
    if (useKey && keygenLevel < r.key!.keygenNeeded) keygenShort.push({ upgradeId: r.upgradeId, needs: r.key!.keygenNeeded });
  }
  const reqFor = kb.reqFn();
  const start = { ...character, required: character.required ?? reqFor(character.level) };
  const after = start.required !== null ? addXp(start, xp, reqFor) : null;
  return { cost, xp, partial, after, keygenShort };
}
