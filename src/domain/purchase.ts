// Purchase planning: what will this buy cost, how much XP should it give,
// which numbers are missing, and is it even allowed.

import { methodsFor } from "./catalog";
import { isVerified, Knowledge, Lookup } from "./knowledge";
import type { CatalogEntry, Method } from "./types";

export type MissingKind =
  | "store_price" | "store_exp"
  | "download_price" | "download_exp"
  | "one_time_price" | "one_time_exp";

export interface MissingField {
  kind: MissingKind;
  upgradeId: string;
  fromLevel: number;
  toLevel: number;
  label: string;
  /** "conflict" when observations disagree, "unknown" when nobody has recorded it. */
  reason: "unknown" | "conflict";
}

export interface PlanLine {
  fromLevel: number;
  toLevel: number;
  cost: Lookup;
  /** "observed" = direct observation, "component_sum" = estimate from per-level download components */
  costSource: "observed" | "component_sum" | "missing";
  exp: Lookup;
}

export interface PurchasePlan {
  entry: CatalogEntry;
  method: Method;
  fromLevel: number;
  toLevel: number;
  errors: string[];
  warnings: string[];
  lines: PlanLine[];
  totalCost: number | null;
  totalExp: number | null;
  missing: MissingField[];
  /** True when any value used is only observed once / an estimate. */
  usesUnverified: boolean;
  levelsGained: number;
}

export interface PlanInput {
  entry: CatalogEntry;
  method: Method;
  currentLevel: number;
  /** Destination level. Ignored for one-time items (always 1). */
  targetLevel: number;
  keygenLevel: number;
  kb: Knowledge;
}

const missingFrom = (l: Lookup): "unknown" | "conflict" => (l.reliability === "conflict" ? "conflict" : "unknown");

export function planPurchase(input: PlanInput): PurchasePlan {
  const { entry, method, kb } = input;
  const oneTime = entry.kind === "one_time";
  const fromLevel = input.currentLevel;
  const toLevel = oneTime ? 1 : input.targetLevel;

  const plan: PurchasePlan = {
    entry, method, fromLevel, toLevel, errors: [], warnings: [], lines: [],
    totalCost: null, totalExp: null, missing: [], usesUnverified: false, levelsGained: Math.max(0, toLevel - fromLevel)
  };

  if (!methodsFor(entry).includes(method)) {
    plan.errors.push(`${entry.name} can't be bought by ${method}.`);
    return plan;
  }

  if (oneTime) {
    if (fromLevel >= 1) {
      plan.errors.push(`${entry.name} is already purchased. It's a one-time item.`);
      return plan;
    }
    const cost = kb.oneTimeItemPrice(entry.id);
    const exp = kb.oneTimeItemExp(entry.id);
    plan.lines.push({ fromLevel: 0, toLevel: 1, cost, exp, costSource: cost.value === null ? "missing" : "observed" });
    if (cost.value === null) plan.missing.push({ kind: "one_time_price", upgradeId: entry.id, fromLevel: 0, toLevel: 1, label: `${entry.name} price`, reason: missingFrom(cost) });
    if (exp.value === null) plan.missing.push({ kind: "one_time_exp", upgradeId: entry.id, fromLevel: 0, toLevel: 1, label: `${entry.name} XP reward`, reason: missingFrom(exp) });
    return finish(plan);
  }

  if (!Number.isInteger(toLevel) || toLevel <= fromLevel) {
    plan.errors.push(`Pick a destination level above your current level (${fromLevel}).`);
    return plan;
  }
  if (entry.maxLevel !== null && toLevel > entry.maxLevel) {
    plan.errors.push(`${entry.name} maxes out at level ${entry.maxLevel}.`);
    return plan;
  }

  if (method === "store") {
    for (let l = fromLevel + 1; l <= toLevel; l++) {
      const cost = kb.storeLevelPrice(entry.id, l);
      const exp = kb.storeLevelExp(entry.id, l);
      plan.lines.push({ fromLevel: l - 1, toLevel: l, cost, exp, costSource: cost.value === null ? "missing" : "observed" });
      if (cost.value === null) plan.missing.push({ kind: "store_price", upgradeId: entry.id, fromLevel: l - 1, toLevel: l, label: `${entry.name} store price for level ${l}`, reason: missingFrom(cost) });
      if (exp.value === null) plan.missing.push({ kind: "store_exp", upgradeId: entry.id, fromLevel: l - 1, toLevel: l, label: `${entry.name} store XP for level ${l}`, reason: missingFrom(exp) });
    }
    if (entry.defensiveDiscount) plan.warnings.push("Defensive store discount (15%) applies. Prices here are the final prices the game charged; the rounding rule is not confirmed.");
    return finish(plan);
  }

  // ---- download ----
  if (input.keygenLevel < toLevel) {
    plan.errors.push(`Your Keygen is level ${input.keygenLevel}. A key for a level ${toLevel} download needs Keygen ${toLevel} or higher.`);
    return plan;
  }
  plan.warnings.push("Keygen rule (Keygen level ≥ destination level) is based on early reports and still being verified.");

  let cost = kb.downloadCombinedPrice(entry.id, fromLevel, toLevel);
  let costSource: PlanLine["costSource"] = cost.value === null ? "missing" : "observed";
  if (cost.value === null) {
    const parts: Lookup[] = [];
    for (let l = fromLevel + 1; l <= toLevel; l++) parts.push(kb.downloadComponentPrice(entry.id, l));
    if (parts.every((p) => p.value !== null)) {
      const sum = parts.reduce((s, p) => s + (p.value as number), 0);
      cost = { value: sum, reliability: "observed_once", count: 0, values: [sum], disputed: false, ids: parts.flatMap((p) => p.ids) };
      costSource = "component_sum";
      plan.warnings.push("Download cost is estimated by adding per-level cost components. Record the real total to confirm.");
    }
  }
  const exp = kb.downloadExp(entry.id, toLevel);
  plan.lines.push({ fromLevel, toLevel, cost, exp, costSource });
  if (cost.value === null) plan.missing.push({ kind: "download_price", upgradeId: entry.id, fromLevel, toLevel, label: `${entry.name} download cost ${fromLevel} → ${toLevel}`, reason: missingFrom(cost) });
  if (exp.value === null) plan.missing.push({ kind: "download_exp", upgradeId: entry.id, fromLevel, toLevel, label: `${entry.name} download XP at level ${toLevel}`, reason: missingFrom(exp) });
  return finish(plan);
}

function finish(plan: PurchasePlan): PurchasePlan {
  const costs = plan.lines.map((l) => l.cost.value);
  const exps = plan.lines.map((l) => l.exp.value);
  plan.totalCost = costs.every((c) => c !== null) ? costs.reduce<number>((s, c) => s + (c as number), 0) : null;
  plan.totalExp = exps.every((e) => e !== null) ? exps.reduce<number>((s, e) => s + (e as number), 0) : null;
  plan.usesUnverified = plan.lines.some(
    (l) => l.costSource === "component_sum" ||
      (l.cost.value !== null && !isVerified(l.cost.reliability)) ||
      (l.exp.value !== null && !isVerified(l.exp.reliability))
  );
  return plan;
}

/** Totals once the player has typed in the missing numbers. Key = missingKey(field). */
export const missingKey = (m: Pick<MissingField, "kind" | "fromLevel" | "toLevel">) => `${m.kind}:${m.fromLevel}:${m.toLevel}`;

export function totalsWithEntered(plan: PurchasePlan, entered: Record<string, number | undefined>) {
  let cost: number | null = 0;
  let exp: number | null = 0;
  for (const line of plan.lines) {
    const ck = plan.method === "download" ? "download_price" : plan.entry.kind === "one_time" ? "one_time_price" : "store_price";
    const ek = plan.method === "download" ? "download_exp" : plan.entry.kind === "one_time" ? "one_time_exp" : "store_exp";
    const typed = entered[missingKey({ kind: ck, fromLevel: line.fromLevel, toLevel: line.toLevel })];
    // A real total typed by the player beats an estimate built from components.
    const c = line.costSource === "component_sum" ? typed ?? line.cost.value ?? undefined : line.cost.value ?? typed;
    const e = line.exp.value ?? entered[missingKey({ kind: ek, fromLevel: line.fromLevel, toLevel: line.toLevel })];
    cost = cost === null || c === undefined ? null : cost + c;
    exp = exp === null || e === undefined ? null : exp + e;
  }
  return { cost, exp };
}
