// Readers for text copied straight out of the game (Select all → Copy → paste into the app).
// Pure functions: they only say what they found. The screens show a preview before anything is saved.
//
// Home:  "R3  LVL 24 // REP 1351 … // XP PROGRESS 5870 / 17993"
// Apps:  "Firewall  LVL 21 (+3)"  ·  "LOCKED  LVL 44 available  52,375 Crypto"  ·  "Trace  NOT INSTALLED"
// Store: "Bypasser  LVL 21  Breaks through …  41,877 Crypto  UPGRADE"   (LVL = the level you'd be buying)
//        Device / Network / Botnet show a model name instead (Bolt II, 10G Fiber+, Hive …).

import { CATALOG, getEntry } from "./catalog";

/** Model names in the store, mapped to the level they are. (Level 1 is what you start with.) */
export const MODEL_LEVELS: Record<string, { upgradeId: string; level: number }> = Object.fromEntries([
  ...["Raider", "Raider II", "Raider III", "Bolt", "Bolt II", "Bolt III", "Nova", "Nova II", "Nova III", "Nova S", "Nova X", "Nova Ultra"]
    .map((n, i) => [n, { upgradeId: "device", level: i + 1 }]),
  ...["Dial-up", "Cable", "Cable+", "4G LTE", "5G", "5G+", "Fiber", "Fiber+", "10G Fiber", "10G Fiber+", "Quantum Link"]
    .map((n, i) => [n, { upgradeId: "network", level: i + 1 }]),
  ...["Free", "Node", "Cluster", "Grid", "Farm", "Hive", "Nexus"]
    .map((n, i) => [n, { upgradeId: "botnet", level: i + 1 }])
]);

const num = (s: string) => Number(s.replace(/[,\s]/g, ""));
const clean = (t: string) => t.replace(/\r/g, "").replace(/[   ]/g, " ");

// ---------------------------------------------------------------- home / XP

export interface HomePaste { level: number | null; exp: number | null; required: number | null; reboots: number | null }

/**
 * Reads LVL, XP progress and the R number from anything that contains them:
 * the whole home screen, "5870 / 17993", "24 5870 17993" or "LVL 24 5870/17993".
 */
export function parseHome(text: string): HomePaste {
  const t = clean(text);
  const out: HomePaste = { level: null, exp: null, required: null, reboots: null };
  const r = t.match(/\bR\s?(\d{1,3})\b/);
  if (r) out.reboots = num(r[1]);
  const lvl = t.match(/\bL(?:VL|v|evel)\.?\s*(\d{1,4})\b/i);
  if (lvl) out.level = num(lvl[1]);
  // Prefer the XP PROGRESS line; otherwise the first "a / b" that isn't a daily-mission counter like 20/6.
  const xpBlock = t.match(/XP\s*PROGRESS[^\d]*([\d,]+)\s*\/\s*([\d,]+)/i);
  const pair = xpBlock ?? [...t.matchAll(/([\d,]+)\s*\/\s*([\d,]+)/g)].find((m) => num(m[1]) < num(m[2]));
  if (pair) { out.exp = num(pair[1]); out.required = num(pair[2]); }
  if (out.exp === null && out.level === null) {
    // Just numbers typed in a row: "24 5870 17993" or "5870 17993"
    const ns = (t.match(/\d[\d,]*/g) ?? []).map(num);
    if (ns.length === 3) [out.level, out.exp, out.required] = ns;
    else if (ns.length === 2) [out.exp, out.required] = ns;
  }
  return out;
}

// ---------------------------------------------------------------- shared segmenting

interface Segment { upgradeId: string; name: string; modelLevel: number | null; body: string }

const NAMES: { label: string; upgradeId: string; modelLevel: number | null }[] = [
  ...CATALOG.map((e) => ({ label: e.name, upgradeId: e.id, modelLevel: null })),
  ...Object.entries(MODEL_LEVELS).map(([label, m]) => ({ label, upgradeId: m.upgradeId, modelLevel: m.level }))
].sort((a, b) => b.label.length - a.label.length);

/** Splits the paste at lines that START with a program or model name (descriptions mention names mid-sentence). */
function segments(text: string): Segment[] {
  const out: Segment[] = [];
  let cur: Segment | null = null;
  for (const raw of clean(text).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const hit = NAMES.find((n) => line.startsWith(n.label) && !/[A-Za-z0-9+]/.test(line.charAt(n.label.length)));
    if (hit) {
      cur = { upgradeId: hit.upgradeId, name: hit.label, modelLevel: hit.modelLevel, body: line.slice(hit.label.length) };
      out.push(cur);
    } else if (cur) {
      cur.body += "\n" + line;
    }
  }
  return out;
}

/** First "LVL n" (with an optional "(+3)" bonus) that is NOT a key offer ("LVL 44 available"). */
function ownLevel(body: string): { level: number; bonus: number } | null {
  for (const m of body.matchAll(/\bLVL\s*(\d+)(?:\s*\(\s*\+\s*(\d+)\s*\))?/gi)) {
    if (/^\s*available/i.test(body.slice((m.index ?? 0) + m[0].length))) continue;
    return { level: num(m[1]), bonus: m[2] ? num(m[2]) : 0 };
  }
  return null;
}

const PRICE = /([\d][\d,]*)\s*Crypto\b/i;
const looksLikeApps = (t: string) => /\bavailable\b/i.test(t) || /NOT\s+INSTALLED/i.test(t) || /Installed\s+Applications/i.test(t);
const looksLikeStore = (t: string) => /\bUPGRADE\b/.test(t) || /read more/i.test(t);

// ---------------------------------------------------------------- store

export interface StoreItem {
  upgradeId: string;
  /** What the paste called it (a model name for Device / Network / Botnet). */
  label: string;
  /** The level this price buys. */
  toLevel: number;
  price: number;
  oneTime: boolean;
}

export interface StorePaste { items: StoreItem[]; warnings: string[]; skipped: string[] }

export function parseStore(text: string): StorePaste {
  const warnings: string[] = [];
  const skipped: string[] = [];
  if (looksLikeApps(text) && !looksLikeStore(text)) {
    warnings.push("This looks like the Apps screen, not the Store. Paste it in the Apps box instead.");
  }
  const items: StoreItem[] = [];
  for (const s of segments(text)) {
    const e = getEntry(s.upgradeId);
    const price = s.body.match(PRICE);
    if (!price) { skipped.push(`${s.name}: no price (maxed or owned?)`); continue; }
    const shown = ownLevel(s.body);
    let toLevel: number | null = null;
    if (e.kind === "one_time") toLevel = 1;
    else if (s.modelLevel !== null) toLevel = s.modelLevel;
    else if (shown) toLevel = shown.level;
    if (toLevel === null || toLevel < 1) { skipped.push(`${s.name}: couldn't find the level`); continue; }
    if (e.maxLevel !== null && toLevel > e.maxLevel) { skipped.push(`${s.name}: level ${toLevel} is past the max (${e.maxLevel})`); continue; }
    if (items.some((i) => i.upgradeId === e.id)) continue; // first one wins
    items.push({ upgradeId: e.id, label: s.name, toLevel, price: num(price[1]), oneTime: e.kind === "one_time" });
  }
  if (!items.length && !warnings.length) warnings.push("No store prices found. Copy the Store's Upgrades list (Select all → Copy) and paste the whole thing.");
  return { items, warnings, skipped };
}

// ---------------------------------------------------------------- apps

export interface AppsLevel { upgradeId: string; level: number; bonus: number }
export interface AppsKey { upgradeId: string; fromLevel: number; toLevel: number; price: number }
export interface AppsPaste { levels: AppsLevel[]; keys: AppsKey[]; keygenLevel: number | null; warnings: string[] }

export function parseApps(text: string): AppsPaste {
  const warnings: string[] = [];
  if (looksLikeStore(text) && !looksLikeApps(text)) {
    warnings.push("This looks like the Store, not the Apps screen. Paste it in the Store box instead.");
  }
  const levels: AppsLevel[] = [];
  const keys: AppsKey[] = [];
  // Header line "SPAM 11 / 44  Botnet - Hive" gives the botnet level.
  const bot = clean(text).match(/Botnet\s*[-–—:]\s*(Free|Node|Cluster|Grid|Farm|Hive|Nexus)\b/);
  if (bot) levels.push({ upgradeId: "botnet", level: MODEL_LEVELS[bot[1]].level, bonus: 0 });

  for (const s of segments(text)) {
    if (s.modelLevel !== null) continue; // model names don't appear as apps
    const e = getEntry(s.upgradeId);
    if (levels.some((l) => l.upgradeId === e.id)) continue;
    let level: number | null = null;
    let bonus = 0;
    if (/NOT\s+INSTALLED/i.test(s.body)) level = 0;
    else {
      const m = ownLevel(s.body);
      if (m) { level = m.level; bonus = m.bonus; }
      else if (e.kind === "one_time") level = 1; // listed under Installed Applications = owned
    }
    if (level === null) continue;
    if (e.kind === "one_time") level = Math.min(level, 1);
    levels.push({ upgradeId: e.id, level, bonus });
    const key = s.body.match(/\bLVL\s*(\d{1,4})\s*available/i);
    const price = s.body.match(PRICE);
    if (key && price && e.download && num(key[1]) > level) {
      keys.push({ upgradeId: e.id, fromLevel: level, toLevel: num(key[1]), price: num(price[1]) });
    }
  }
  const kg = levels.find((l) => l.upgradeId === "keygen");
  if (!levels.length && !warnings.length) warnings.push("No apps found. Open Apps, Select all → Copy, and paste the whole thing.");
  return { levels, keys, keygenLevel: kg ? kg.level : null, warnings };
}
