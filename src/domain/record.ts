// Turning a confirmed purchase into (1) a personal history record and
// (2) candidate observations the player may choose to share.
// Nothing here marks anything as "confirmed": contributions are always plain observations.

import { inferExpGained, ExpInference, ReqFn } from "./exp";
import { isVerified, Knowledge, RELIABILITY_LABEL } from "./knowledge";
import { missingKey, PurchasePlan, totalsWithEntered } from "./purchase";
import type {
  CharacterState, Confidence, ExpObservation, LevelRequirementObservation, PriceObservation, PurchaseRecord
} from "./types";

export type Candidate =
  | { type: "price"; label: string; why: string; checked: boolean; data: PriceObservation }
  | { type: "exp"; label: string; why: string; checked: boolean; data: ExpObservation }
  | { type: "level_req"; label: string; why: string; checked: boolean; data: LevelRequirementObservation };

export interface RecordInput {
  plan: PurchasePlan;
  entered: Record<string, number | undefined>;
  before: CharacterState;
  after: CharacterState;
  keygenLevel: number | null;
  kb: Knowledge;
  reqFor: ReqFn;
  contributor: string;
  notes: string;
  now: string;
  newId: () => string;
}

export interface RecordResult {
  record: PurchaseRecord;
  inference: ExpInference;
  candidates: Candidate[];
  warnings: string[];
}

export function buildRecord(input: RecordInput): RecordResult {
  const { plan, entered, before, after, kb, now, newId, contributor } = input;
  const purchaseId = newId();
  const inference = inferExpGained(before, after, input.reqFor);
  const totals = totalsWithEntered(plan, entered);
  const warnings: string[] = [];
  const candidates: Candidate[] = [];

  const oneTime = plan.entry.kind === "one_time";
  const priceKind = plan.method === "download" ? "download_price" : oneTime ? "one_time_price" : "store_price";
  const expKind = plan.method === "download" ? "download_exp" : oneTime ? "one_time_exp" : "store_exp";
  const base = { contributor, createdAt: now, status: "observed" as const, notes: input.notes, purchaseId };

  // ---- prices the player typed in ----
  for (const line of plan.lines) {
    if (line.cost.value !== null && line.costSource === "observed") continue;
    const v = entered[missingKey({ kind: priceKind, fromLevel: line.fromLevel, toLevel: line.toLevel })];
    if (v === undefined) continue;
    const costType = plan.method === "download" ? "combined" : oneTime ? "one_time" : "per_level";
    candidates.push({
      type: "price", checked: true,
      label: plan.method === "download"
        ? `${plan.entry.name} download ${line.fromLevel} → ${line.toLevel}: ${v.toLocaleString()}`
        : oneTime ? `${plan.entry.name} price: ${v.toLocaleString()}` : `${plan.entry.name} store level ${line.toLevel}: ${v.toLocaleString()}`,
      why: line.cost.reliability === "conflict" ? "Adds your value to a conflicting record" : "Not in the database yet",
      data: {
        ...base, id: newId(), upgradeId: plan.entry.id, method: plan.method, fromLevel: line.fromLevel, toLevel: line.toLevel,
        cost: v, costType, priceBasis: "final", keygenLevel: plan.method === "download" ? input.keygenLevel : null
      }
    });
  }

  // ---- XP the player typed in ----
  const expFor = (fromLevel: number, toLevel: number) =>
    entered[missingKey({ kind: expKind, fromLevel, toLevel })];
  for (const line of plan.lines) {
    if (line.exp.value !== null) continue;
    const v = expFor(line.fromLevel, line.toLevel);
    if (v === undefined) continue;
    candidates.push({
      type: "exp", checked: true,
      label: `${plan.entry.name} ${plan.method === "download" ? "download" : "store"} XP at level ${line.toLevel}: ${v}`,
      why: "You entered it from the game",
      data: {
        ...base, id: newId(), upgradeId: plan.entry.id, method: plan.method, fromLevel: line.fromLevel, toLevel: line.toLevel,
        exp: v, expBasis: plan.method === "download" ? "per_transaction" : "per_level", source: "entered"
      }
    });
  }

  // ---- XP worked out from the character screen ----
  if (inference.status === "invalid") warnings.push(inference.error ?? "Character numbers don't add up.");
  if (inference.status === "incomplete") {
    warnings.push(`Can't calculate exact XP: the XP needed for character level ${inference.missingLevels.join(", ")} is unknown. At least ${inference.atLeast} XP was earned.`);
  }
  if (inference.status === "exact" && inference.exp !== null) {
    const gained = inference.exp;
    const unknownLines = plan.lines.filter((l) => l.exp.value === null && expFor(l.fromLevel, l.toLevel) === undefined);
    const knownSum = plan.lines.reduce((s, l) => s + (l.exp.value ?? expFor(l.fromLevel, l.toLevel) ?? 0), 0);

    if (unknownLines.length === 0) {
      if (knownSum !== gained) {
        warnings.push(`Your character gained ${gained} XP, but the known rewards add up to ${knownSum}. Something may be wrong (another XP source, a typo, or a bad record). Nothing was inferred.`);
      }
    } else if (unknownLines.length === 1) {
      const line = unknownLines[0];
      const value = gained - knownSum;
      if (value < 0) {
        warnings.push(`Known rewards (${knownSum}) are more than the XP your character gained (${gained}). Nothing was inferred.`);
      } else {
        const single = plan.lines.length === 1;
        candidates.push({
          type: "exp", checked: true,
          label: `${plan.entry.name} ${plan.method === "download" ? "download" : "store"} XP at level ${line.toLevel}: ${value}`,
          why: single ? `Worked out from your character XP (+${gained})` : `Worked out: +${gained} total minus ${knownSum} from known levels`,
          data: {
            ...base, id: newId(), upgradeId: plan.entry.id, method: plan.method, fromLevel: line.fromLevel, toLevel: line.toLevel,
            exp: value, expBasis: plan.method === "download" ? "per_transaction" : "per_level", source: single ? "inferred" : "derived"
          }
        });
      }
    } else {
      // Several store levels unknown: we only know their total. Keep it as one transaction observation.
      candidates.push({
        type: "exp", checked: true,
        label: `${plan.entry.name} store XP for levels ${plan.fromLevel + 1}–${plan.toLevel} combined: ${gained}`,
        why: "Worked out from your character XP. Individual levels can't be split yet.",
        data: {
          ...base, id: newId(), upgradeId: plan.entry.id, method: plan.method, fromLevel: plan.fromLevel, toLevel: plan.toLevel,
          exp: gained, expBasis: "per_transaction", source: "inferred"
        }
      });
    }
  }

  // ---- character level requirements ----
  const reqCandidate = (s: CharacterState) => {
    if (s.required === null) return;
    const known = kb.levelRequirement(s.level);
    const already = known.value === s.required && isVerified(known.reliability);
    candidates.push({
      type: "level_req", checked: !already,
      label: `Character level ${s.level} needs ${s.required.toLocaleString()} XP`,
      why: known.value === null ? (known.reliability === "conflict" ? "Conflicting records" : "Not in the database yet")
        : known.value === s.required ? `Repeats a known value (${RELIABILITY_LABEL[known.reliability]})` : `Database says ${known.value}`,
      data: { id: newId(), level: s.level, expRequired: s.required, contributor, createdAt: now, status: "observed", notes: "" }
    });
  };
  reqCandidate(before);
  if (after.level !== before.level) reqCandidate(after);

  // ---- personal record ----
  const anyEntered = plan.lines.some((l) => (l.cost.value === null || l.costSource === "component_sum") &&
    entered[missingKey({ kind: priceKind, fromLevel: l.fromLevel, toLevel: l.toLevel })] !== undefined);
  const estimate = plan.lines.some((l) => l.costSource === "component_sum" &&
    entered[missingKey({ kind: priceKind, fromLevel: l.fromLevel, toLevel: l.toLevel })] === undefined);
  const costSource: PurchaseRecord["costSource"] =
    totals.cost === null ? "missing" : estimate ? "estimate" : anyEntered ? "entered" : "observed";

  let confidence: Confidence = "exact";
  if (totals.cost === null || inference.status !== "exact") confidence = "incomplete";
  else if (estimate) confidence = "estimate";
  else if (plan.usesUnverified) confidence = "uses_unverified";

  const dataSources = plan.lines.flatMap((l) => {
    const step = plan.method === "download" ? `${l.fromLevel}→${l.toLevel}` : `L${l.toLevel}`;
    return [
      `Cost ${step}: ${l.cost.value !== null ? (l.costSource === "component_sum" ? "estimate from components" : `${RELIABILITY_LABEL[l.cost.reliability]} (${l.cost.count})`) : "entered by you or missing"}`,
      `XP ${step}: ${l.exp.value !== null ? `${RELIABILITY_LABEL[l.exp.reliability]} (${l.exp.count})` : "entered/inferred or missing"}`
    ];
  });
  dataSources.push(`Character XP: ${inference.status}`);

  const record: PurchaseRecord = {
    id: purchaseId, createdAt: now, upgradeId: plan.entry.id, method: plan.method,
    fromLevel: plan.fromLevel, toLevel: plan.toLevel, keygenLevel: plan.method === "download" ? input.keygenLevel : null,
    cost: totals.cost, costSource, expEarned: inference.status === "exact" ? inference.exp : null,
    expExpected: totals.exp, before, after, confidence, dataSources, notes: input.notes
  };

  return { record, inference, candidates, warnings };
}
