// Finds places where players reported different values for the same thing,
// grouped exactly the way the Knowledge lookups group them, so the admin can decide.

import { getEntry } from "./catalog";
import { consensus } from "./knowledge";
import type { ExpObservation, LevelRequirementObservation, ObservationSet, PriceObservation } from "./types";

export type ConflictType = "price" | "exp" | "level_req";
type Row = PriceObservation | ExpObservation | LevelRequirementObservation;

export interface ConflictOption {
  value: number;
  rows: Row[];
  /** True if an admin already confirmed this value. */
  confirmed: boolean;
}

export interface ConflictGroup {
  type: ConflictType;
  key: string;
  title: string;
  subtitle: string;
  options: ConflictOption[];
  /** A confirmed value exists but a newer report disagrees with it. */
  challengesConfirmed: boolean;
  latest: string;
}

const priceKey = (p: PriceObservation): [string, string, string] | null => {
  const e = getEntry(p.upgradeId);
  const list = p.priceBasis === "before_discount" ? " (list price before discount)" : "";
  if (p.costType === "one_time") return [`p1|${p.upgradeId}|${p.priceBasis}`, e.name, `Price${list}`];
  if (p.method === "store") return [`ps|${p.upgradeId}|${p.toLevel}|${p.priceBasis}`, e.name, `Store price · level ${p.toLevel}${list}`];
  if (p.costType === "component") return [`pc|${p.upgradeId}|${p.toLevel}|${p.priceBasis}`, e.name, `Download cost component · level ${p.toLevel}`];
  return [`pd|${p.upgradeId}|${p.fromLevel}|${p.toLevel}|${p.priceBasis}`, e.name, `Download total · ${p.fromLevel} → ${p.toLevel}`];
};

const expKey = (x: ExpObservation): [string, string, string] => {
  const e = getEntry(x.upgradeId);
  if (e.kind === "one_time") return [`x1|${x.upgradeId}`, e.name, "EXP reward"];
  if (x.method === "download") return [`xd|${x.upgradeId}|${x.toLevel}`, e.name, `Download EXP · destination level ${x.toLevel}`];
  if (x.expBasis === "per_transaction") return [`xt|${x.upgradeId}|${x.fromLevel}|${x.toLevel}`, e.name, `Store EXP · levels ${x.fromLevel + 1}–${x.toLevel} combined`];
  return [`xs|${x.upgradeId}|${x.toLevel}`, e.name, `Store EXP · level ${x.toLevel}`];
};

function collect<T extends Row>(
  type: ConflictType, rows: T[], key: (r: T) => [string, string, string] | null, value: (r: T) => number, out: ConflictGroup[]
) {
  const groups = new Map<string, { title: string; subtitle: string; rows: T[] }>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const g = groups.get(k[0]);
    if (g) g.rows.push(r); else groups.set(k[0], { title: k[1], subtitle: k[2], rows: [r] });
  }
  for (const [k, g] of groups) {
    const c = consensus(g.rows.map((r) => ({ id: r.id, value: value(r), status: r.status })));
    if (c.reliability !== "conflict" && !c.disputed) continue;
    const live = g.rows.filter((r) => r.status !== "rejected");
    const byValue = new Map<number, T[]>();
    for (const r of live) byValue.set(value(r), [...(byValue.get(value(r)) ?? []), r]);
    const options = [...byValue.entries()]
      .map(([v, rs]) => ({ value: v, rows: rs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)), confirmed: rs.some((r) => r.status === "confirmed") }))
      .sort((a, b) => b.rows.length - a.rows.length || a.value - b.value);
    out.push({
      type, key: k, title: g.title, subtitle: g.subtitle, options,
      challengesConfirmed: c.reliability === "confirmed",
      latest: live.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), "")
    });
  }
}

export function findConflicts(obs: ObservationSet): ConflictGroup[] {
  const out: ConflictGroup[] = [];
  collect("price", obs.prices, priceKey, (r) => r.cost, out);
  collect("exp", obs.exp, expKey, (r) => r.exp, out);
  collect("level_req", obs.levelReqs, (r) => [`r|${r.level}`, "Character", `EXP needed at level ${r.level}`], (r) => r.expRequired, out);
  return out.sort((a, b) => b.latest.localeCompare(a.latest));
}

/** Which ids to confirm and reject when the admin picks `value`. */
export function resolution(group: ConflictGroup, value: number) {
  const keep = group.options.filter((o) => o.value === value).flatMap((o) => o.rows.map((r) => r.id));
  const reject = group.options.filter((o) => o.value !== value).flatMap((o) => o.rows.map((r) => r.id));
  return { keep, reject };
}
