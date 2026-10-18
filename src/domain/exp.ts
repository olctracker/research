// Character EXP maths. EXP carries over when a character levels up, and every level
// can need a different amount, so we always walk level by level with real thresholds.

import type { CharacterState } from "./types";

export type ReqFn = (level: number) => number | null;

export interface ExpBreakdownLine {
  level: number;
  amount: number;
  note: string;
}

export interface ExpInference {
  status: "exact" | "incomplete" | "invalid";
  /** Exact EXP gained (only when status is "exact"). */
  exp: number | null;
  /** Smallest EXP gain consistent with what is known (useful when incomplete). */
  atLeast: number | null;
  /** Character levels whose requirement we would need to finish the calculation. */
  missingLevels: number[];
  breakdown: ExpBreakdownLine[];
  error?: string;
}

export function validateCharacter(s: CharacterState): string | null {
  if (!Number.isInteger(s.level) || s.level < 1) return "Character level must be 1 or more";
  if (!Number.isInteger(s.exp) || s.exp < 0) return "EXP must be a whole number, 0 or more";
  if (s.required !== null) {
    if (!Number.isInteger(s.required) || s.required <= 0) return "Next-level EXP must be more than 0";
    if (s.exp >= s.required) return "Current EXP should be less than the next-level requirement";
  }
  return null;
}

/**
 * Works out how much EXP was earned between two character snapshots.
 * The requirement for the starting level comes from `before.required` first, then `reqFor`.
 * Intermediate levels come from `reqFor`. Unknown thresholds make the result "incomplete".
 */
export function inferExpGained(before: CharacterState, after: CharacterState, reqFor: ReqFn): ExpInference {
  const invalid = (error: string): ExpInference =>
    ({ status: "invalid", exp: null, atLeast: null, missingLevels: [], breakdown: [], error });

  const e1 = validateCharacter(before);
  if (e1) return invalid(`Before: ${e1}`);
  const e2 = validateCharacter(after);
  if (e2) return invalid(`After: ${e2}`);
  if (after.level < before.level) return invalid("Character level went down. Check the numbers (or a reboot happened).");

  if (after.level === before.level) {
    const diff = after.exp - before.exp;
    if (diff < 0) return invalid("EXP went down without a level change. Check the numbers.");
    return {
      status: "exact", exp: diff, atLeast: diff, missingLevels: [],
      breakdown: [{ level: before.level, amount: diff, note: `${before.exp} → ${after.exp} within level ${before.level}` }]
    };
  }

  const breakdown: ExpBreakdownLine[] = [];
  const missing: number[] = [];
  let known = 0;

  const startReq = before.required ?? reqFor(before.level);
  if (startReq === null) missing.push(before.level);
  else {
    const rest = startReq - before.exp;
    if (rest <= 0) return invalid(`Before EXP ${before.exp} is not below the level ${before.level} requirement ${startReq}.`);
    known += rest;
    breakdown.push({ level: before.level, amount: rest, note: `finishes level ${before.level} (${before.exp}/${startReq})` });
  }

  for (let l = before.level + 1; l < after.level; l++) {
    const r = reqFor(l);
    if (r === null) { missing.push(l); continue; }
    known += r;
    breakdown.push({ level: l, amount: r, note: `all of level ${l}` });
  }

  known += after.exp;
  breakdown.push({ level: after.level, amount: after.exp, note: `carried into level ${after.level}` });

  if (missing.length) {
    // Each unknown level needs at least 1 EXP; the starting level at least 1 more than nothing.
    return { status: "incomplete", exp: null, atLeast: known + missing.length, missingLevels: missing, breakdown };
  }
  return { status: "exact", exp: known, atLeast: known, missingLevels: [], breakdown };
}

export interface ExpProjection {
  status: "exact" | "incomplete";
  state: CharacterState | null;
  missingLevels: number[];
  levelsGained: number;
}

/** Predicts the character state after gaining `gain` EXP (used to preview a purchase). */
export function applyExp(start: CharacterState, gain: number, reqFor: ReqFn): ExpProjection {
  let level = start.level;
  let exp = start.exp + gain;
  let req = start.required ?? reqFor(level);
  for (let guard = 0; guard < 10000; guard++) {
    if (req === null) return { status: "incomplete", state: null, missingLevels: [level], levelsGained: level - start.level };
    if (exp < req) break;
    exp -= req;
    level += 1;
    req = reqFor(level);
  }
  return { status: "exact", state: { level, exp, required: req }, missingLevels: [], levelsGained: level - start.level };
}
