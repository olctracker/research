// Research coverage. Every percentage is measured against an explicit list of expected
// data points, and the range is always reported so nobody mistakes "levels 1–20 known"
// for "everything known" on an upgrade with no known cap.

import { CATALOG } from "./catalog";
import { Knowledge, Lookup, Reliability } from "./knowledge";
import type { CatalogEntry, Category, Method } from "./types";

export type SeriesKind = "store_price" | "store_exp" | "download_component" | "download_exp" | "one_time_price" | "one_time_exp" | "level_req";

export const SERIES_LABEL: Record<SeriesKind, string> = {
  store_price: "Store price",
  store_exp: "Store XP",
  download_component: "Keygen price (component)",
  download_exp: "Keygen XP",
  one_time_price: "Price",
  one_time_exp: "XP reward",
  level_req: "Character XP needed"
};

export interface DataPoint {
  series: SeriesKind;
  upgradeId: string | null;
  upgradeName: string;
  category: Category | "character";
  method: Method | null;
  level: number;
  lookup: Lookup;
}

export interface SeriesCoverage {
  series: SeriesKind;
  upgradeId: string | null;
  upgradeName: string;
  category: Category | "character";
  rangeFrom: number;
  rangeTo: number;
  /** "cap" = range ends at the game's max level; "horizon" = range ends at the research horizon (not full coverage). */
  rangeKind: "cap" | "horizon" | "single";
  counts: Record<Reliability, number>;
  total: number;
  points: DataPoint[];
}

export interface CompletenessOptions {
  /** How far to measure uncapped upgrades. Extended automatically to the highest observed level. */
  levelHorizon: number;
  characterHorizon: number;
}

export const DEFAULT_COMPLETENESS: CompletenessOptions = { levelHorizon: 20, characterHorizon: 30 };

const emptyCounts = (): Record<Reliability, number> =>
  ({ unknown: 0, observed_once: 0, repeated: 0, confirmed: 0, conflict: 0 });

function series(
  kind: SeriesKind, entry: CatalogEntry | null, from: number, to: number, rangeKind: SeriesCoverage["rangeKind"],
  method: Method | null, get: (level: number) => Lookup
): SeriesCoverage {
  const counts = emptyCounts();
  const points: DataPoint[] = [];
  for (let l = from; l <= to; l++) {
    const lookup = get(l);
    counts[lookup.reliability]++;
    points.push({
      series: kind, upgradeId: entry?.id ?? null, upgradeName: entry?.name ?? "Character",
      category: entry?.category ?? "character", method, level: l, lookup
    });
  }
  return {
    series: kind, upgradeId: entry?.id ?? null, upgradeName: entry?.name ?? "Character",
    category: entry?.category ?? "character", rangeFrom: from, rangeTo: to, rangeKind, counts, total: points.length, points
  };
}

export function computeCompleteness(kb: Knowledge, opts: CompletenessOptions = DEFAULT_COMPLETENESS): SeriesCoverage[] {
  const out: SeriesCoverage[] = [];
  for (const e of CATALOG) {
    if (e.kind === "one_time") {
      out.push(series("one_time_price", e, 1, 1, "single", "store", () => kb.oneTimeItemPrice(e.id)));
      out.push(series("one_time_exp", e, 1, 1, "single", "store", () => kb.oneTimeItemExp(e.id)));
      continue;
    }
    const from = e.startLevel + 1;
    const capped = e.maxLevel !== null;
    const to = capped ? (e.maxLevel as number) : Math.max(opts.levelHorizon, kb.highestObservedLevel(e.id));
    const rk = capped ? "cap" : "horizon";
    out.push(series("store_price", e, from, to, rk, "store", (l) => kb.storeLevelPrice(e.id, l)));
    out.push(series("store_exp", e, from, to, rk, "store", (l) => kb.storeLevelExp(e.id, l)));
    if (e.download) {
      out.push(series("download_component", e, from, to, rk, "download", (l) => kb.downloadComponentPrice(e.id, l)));
      out.push(series("download_exp", e, from, to, rk, "download", (l) => kb.downloadExp(e.id, l)));
    }
  }
  const charTo = Math.max(opts.characterHorizon, kb.highestObservedCharacterLevel());
  out.push(series("level_req", null, 1, charTo, "horizon", null, (l) => kb.levelRequirement(l)));
  return out;
}

export function summarize(rows: SeriesCoverage[]) {
  const counts = emptyCounts();
  let total = 0;
  for (const r of rows) {
    total += r.total;
    (Object.keys(counts) as Reliability[]).forEach((k) => (counts[k] += r.counts[k]));
  }
  const known = counts.observed_once + counts.repeated + counts.confirmed;
  return { counts, total, known, percentKnown: total ? Math.round((known / total) * 1000) / 10 : 0 };
}

/** Research items that aren't level-based data points. */
export const OPEN_QUESTIONS: { title: string; detail: string }[] = [
  { title: "Defensive store discount rounding", detail: "15% discount is known; whether the game rounds up, down or to nearest is unconfirmed. Record final prices and, when you can see it, the list price." },
  { title: "Keygen download rule", detail: "Keygen level ≥ destination level is the working rule. Report any download that contradicts it." },
  { title: "Keygen multi-level jumps", detail: "Purchase records one level at a time. Can Keygen jump several levels in one buy, and does that cost the sum of each level? Not supported yet." },
  { title: "Caps on uncapped software", detail: "No maximum is known for defensive, offensive, virus software or Keygen." },
  { title: "Reboot rules", detail: "Reboot costs and effects are not recorded yet. Reboot planning stays disabled." }
];
