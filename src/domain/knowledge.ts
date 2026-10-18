// Turns raw observations into "what do we currently know" lookups.
// Raw observations are never changed here; this only reads them.

import type {
  ExpObservation, LevelRequirementObservation, Method, ObservationSet, ObservationStatus, PriceObservation
} from "./types";

export type Reliability = "unknown" | "observed_once" | "repeated" | "confirmed" | "conflict";

export interface Lookup {
  /** The value to use, or null when unknown or conflicting. */
  value: number | null;
  reliability: Reliability;
  /** How many non-rejected observations back this key. */
  count: number;
  /** Every distinct value seen (lets the UI show the conflict). */
  values: number[];
  /** True when a usable value exists but some other observation disagrees (only possible with a confirmed value). */
  disputed: boolean;
  ids: string[];
}

export const RELIABILITY_LABEL: Record<Reliability, string> = {
  unknown: "Unknown",
  observed_once: "Observed once",
  repeated: "Repeated observation",
  confirmed: "Confirmed",
  conflict: "Conflicting"
};

/** A value is "verified enough to not warn" only when repeated or confirmed. */
export const isVerified = (r: Reliability) => r === "repeated" || r === "confirmed";
export const isUsable = (l: Lookup) => l.value !== null;

interface Item { id: string; value: number; status: ObservationStatus }

export function consensus(items: Item[]): Lookup {
  const live = items.filter((i) => i.status !== "rejected");
  const values = [...new Set(live.map((i) => i.value))].sort((a, b) => a - b);
  const ids = live.map((i) => i.id);
  const base = { count: live.length, values, ids };
  if (!live.length) return { ...base, value: null, reliability: "unknown", disputed: false };

  const confirmed = [...new Set(live.filter((i) => i.status === "confirmed").map((i) => i.value))];
  if (confirmed.length === 1) {
    return { ...base, value: confirmed[0], reliability: "confirmed", disputed: values.length > 1 };
  }
  if (values.length > 1) return { ...base, value: null, reliability: "conflict", disputed: true };
  return { ...base, value: values[0], reliability: live.length > 1 ? "repeated" : "observed_once", disputed: false };
}

const key = (...p: (string | number)[]) => p.join("|");

function group<T>(rows: T[], k: (r: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const kk = k(r);
    if (kk === null) continue;
    const list = m.get(kk);
    if (list) list.push(r); else m.set(kk, [r]);
  }
  return m;
}

const fromPrice = (p: PriceObservation): Item => ({ id: p.id, value: p.cost, status: p.status });
const fromExp = (e: ExpObservation): Item => ({ id: e.id, value: e.exp, status: e.status });
const fromReq = (r: LevelRequirementObservation): Item => ({ id: r.id, value: r.expRequired, status: r.status });

/**
 * Indexed view over all observations. Only "final" prices (what the game actually charged)
 * are used for cost lookups; before-discount prices are kept for discount research.
 */
export class Knowledge {
  private storePrice: Map<string, PriceObservation[]>;
  private dlCombined: Map<string, PriceObservation[]>;
  private dlComponent: Map<string, PriceObservation[]>;
  private oneTimePrice: Map<string, PriceObservation[]>;
  private perLevelExp: Map<string, ExpObservation[]>;
  private txnExp: Map<string, ExpObservation[]>;
  private reqs: Map<string, LevelRequirementObservation[]>;

  constructor(readonly obs: ObservationSet) {
    const finals = obs.prices.filter((p) => p.priceBasis === "final");
    this.storePrice = group(finals, (p) => (p.method === "store" && p.costType === "per_level" ? key(p.upgradeId, p.toLevel) : null));
    this.dlCombined = group(finals, (p) => (p.method === "download" && p.costType === "combined" ? key(p.upgradeId, p.fromLevel, p.toLevel) : null));
    this.dlComponent = group(finals, (p) => (p.method === "download" && p.costType === "component" ? key(p.upgradeId, p.toLevel) : null));
    this.oneTimePrice = group(finals, (p) => (p.costType === "one_time" ? p.upgradeId : null));
    this.perLevelExp = group(obs.exp, (e) => (e.expBasis === "per_level" && e.method === "store" ? key(e.upgradeId, e.toLevel) : null));
    // Download EXP depends on the destination level only (known mechanic), so key by destination.
    this.txnExp = group(obs.exp, (e) => (e.method === "download" ? key(e.upgradeId, e.toLevel) : null));
    this.reqs = group(obs.levelReqs, (r) => String(r.level));
  }

  storeLevelPrice(upgradeId: string, toLevel: number): Lookup {
    return consensus((this.storePrice.get(key(upgradeId, toLevel)) ?? []).map(fromPrice));
  }
  storeLevelExp(upgradeId: string, toLevel: number): Lookup {
    return consensus((this.perLevelExp.get(key(upgradeId, toLevel)) ?? []).map(fromExp));
  }
  downloadCombinedPrice(upgradeId: string, fromLevel: number, toLevel: number): Lookup {
    return consensus((this.dlCombined.get(key(upgradeId, fromLevel, toLevel)) ?? []).map(fromPrice));
  }
  downloadComponentPrice(upgradeId: string, toLevel: number): Lookup {
    return consensus((this.dlComponent.get(key(upgradeId, toLevel)) ?? []).map(fromPrice));
  }
  downloadExp(upgradeId: string, toLevel: number): Lookup {
    return consensus((this.txnExp.get(key(upgradeId, toLevel)) ?? []).map(fromExp));
  }
  oneTimeItemPrice(upgradeId: string): Lookup {
    return consensus((this.oneTimePrice.get(upgradeId) ?? []).map(fromPrice));
  }
  oneTimeItemExp(upgradeId: string): Lookup {
    return this.storeLevelExp(upgradeId, 1);
  }
  levelRequirement(level: number): Lookup {
    return consensus((this.reqs.get(String(level)) ?? []).map(fromReq));
  }

  /** Requirement lookup for EXP inference: returns a number only when usable. */
  reqFn(): (level: number) => number | null {
    return (level) => this.levelRequirement(level).value;
  }

  /** Highest destination level seen in any observation for this upgrade (for research ranges). */
  highestObservedLevel(upgradeId: string): number {
    let hi = 0;
    for (const p of this.obs.prices) if (p.upgradeId === upgradeId) hi = Math.max(hi, p.toLevel);
    for (const e of this.obs.exp) if (e.upgradeId === upgradeId) hi = Math.max(hi, e.toLevel);
    return hi;
  }
  highestObservedCharacterLevel(): number {
    return this.obs.levelReqs.reduce((m, r) => Math.max(m, r.level), 0);
  }
}

export const methodLabel = (m: Method) => (m === "store" ? "Store" : "Download");
