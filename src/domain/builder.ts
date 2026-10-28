// Character Builder: take every upgrade from a current level to an end level and compare the ways to pay.
// One level at a time (store or 1-level keys: same XP), one big Keygen jump (landing level XP only),
// and a mix of 2–3 level jumps. Built on planRow, so every number is seen in game or a verified formula.

import { getEntry } from "./catalog";
import { planRow, type PlanRow } from "./calc";
import { addXp } from "./exp";
import { charTarget } from "./formulas";
import type { Knowledge } from "./knowledge";

/** Grouped the way the builder shows them. */
export const BUILDER_GROUPS: readonly { title: string; ids: string[] }[] = [
  { title: "Hardware", ids: ["device", "network", "botnet"] },
  { title: "Offensive", ids: ["bypasser", "password_cracker"] },
  { title: "Defensive", ids: ["firewall", "password_encryptor", "antivirus", "proxy", "trace"] },
  { title: "Viruses", ids: ["spam", "siphon", "rootkit"] },
  { title: "Keygen & one-time", ids: ["keygen", "notepad", "message_encryptor"] }
];
export const BUILDER_IDS = BUILDER_GROUPS.flatMap((g) => g.ids);

/** The mixed estimate stops here: past LVL 50, apps above 40 are rarely downloadable, so it's store buying. */
export const MIX_LEVEL_CAP = 50;

/** Lowest level each upgrade can be: hardware starts at 1 (Botnet's Free tier), software and one-time at 0. */
export function floorLevel(id: string): number {
  return getEntry(id).category === "core" ? 1 : 0;
}

export interface Sum { cost: number; xp: number; partial: boolean }
const zero = (): Sum => ({ cost: 0, xp: 0, partial: false });
const add = (s: Sum, cost: number | null, xp: number | null) => {
  if (cost === null) s.partial = true; else s.cost += cost;
  if (xp === null) s.partial = true; else s.xp += xp;
};

/** Keys of `step` levels at a time (the last one may be shorter). Store price for anything keys can't buy. */
export function chunked(kb: Knowledge, row: PlanRow, step: number): Sum {
  const s = zero();
  if (!row.key) { add(s, row.store.cost, row.store.xp); return s; }
  for (let a = row.from; a < row.to; a += step) {
    const k = planRow(kb, row.upgradeId, a, Math.min(a + step, row.to)).key!;
    add(s, k.cost, k.xp);
  }
  return s;
}

export interface BuilderResult {
  rows: PlanRow[];
  /** Every level bought in the store */
  store: Sum;
  /** One 1-level key per level (store for things keys can't buy). Same XP as the store. */
  singleKeys: Sum;
  /** One Keygen jump per app (store for things keys can't buy). Landing level XP only. */
  jump: Sum;
  /** Keys jumping 2 and 3 levels at a time. */
  mix2: Sum;
  mix3: Sum;
  /** Highest level a key lands on (Keygen must be at least this), or 0 when no keys. */
  keygenNeeded: number;
}

export function buildCharacter(kb: Knowledge, levels: Record<string, { from: number; to: number }>): BuilderResult {
  const rows: PlanRow[] = [];
  for (const id of BUILDER_IDS) {
    const l = levels[id];
    if (l && l.to > l.from) rows.push(planRow(kb, id, l.from, l.to));
  }
  const store = zero(), singleKeys = zero(), jump = zero(), mix2 = zero(), mix3 = zero();
  let keygenNeeded = 0;
  for (const r of rows) {
    add(store, r.store.cost, r.store.xp);
    add(singleKeys, (r.singleKeys ?? r.store).cost, r.store.xp);
    add(jump, (r.key ?? r.store).cost, (r.key ?? r.store).xp);
    const m2 = chunked(kb, r, 2), m3 = chunked(kb, r, 3);
    add(mix2, m2.cost, m2.xp); mix2.partial ||= m2.partial;
    add(mix3, m3.cost, m3.xp); mix3.partial ||= m3.partial;
    if (r.key) keygenNeeded = Math.max(keygenNeeded, r.to);
  }
  return { rows, store, singleKeys, jump, mix2, mix3, keygenNeeded };
}

/** Where the character lands after gaining `xp` (XP carries over on level-up). */
export function endingLevel(level: number, exp: number, xp: number) {
  const required = charTarget(level);
  if (required === null || exp >= required) return null;
  return addXp({ level, exp, required }, xp, (l) => charTarget(l));
}
