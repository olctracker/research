// Character XP maths. In Hack EX2 the XP number is a running total: it keeps counting through
// level-ups and only the target after the "/" moves up (150/200 + 100 → LVL 2 at 250/400).

import type { CharacterState } from "./types";

export type ReqFn = (level: number) => number | null;

export interface ExpBreakdownLine {
  level: number;
  amount: number;
  note: string;
}

export interface ExpInference {
  status: "exact" | "incomplete" | "invalid";
  /** Exact XP gained (only when status is "exact"). */
  exp: number | null;
  /** Smallest XP gain consistent with what is known (useful when incomplete). */
  atLeast: number | null;
  /** Character levels whose requirement we would need to finish the calculation. */
  missingLevels: number[];
  breakdown: ExpBreakdownLine[];
  error?: string;
}

export function validateCharacter(s: CharacterState): string | null {
  if (!Number.isInteger(s.level) || s.level < 1) return "Character level must be 1 or more";
  if (!Number.isInteger(s.exp) || s.exp < 0) return "XP must be a whole number, 0 or more";
  if (s.required !== null) {
    if (!Number.isInteger(s.required) || s.required <= 0) return "Next-level XP must be more than 0";
    if (s.exp >= s.required) return "Current XP should be less than the next-level requirement";
  }
  return null;
}

/**
 * Works out how much XP was earned between two character snapshots.
 * Hack EX2 XP is a running total: it does NOT reset on level-up, only the target after the "/" moves up
 * (LVL 1 at 150/200 + 100 XP → LVL 2 at 250/400). So the gain is simply after − before.
 * `reqFor` is only used to sanity-check a level-up (the old target must have been reached).
 */
export function inferExpGained(before: CharacterState, after: CharacterState, reqFor: ReqFn): ExpInference {
  const invalid = (error: string): ExpInference =>
    ({ status: "invalid", exp: null, atLeast: null, missingLevels: [], breakdown: [], error });

  const e1 = validateCharacter(before);
  if (e1) return invalid(`Before: ${e1}`);
  const e2 = validateCharacter(after);
  if (e2) return invalid(`After: ${e2}`);
  if (after.level < before.level) return invalid("Character level went down. Check the numbers (or a reboot happened).");

  const diff = after.exp - before.exp;
  if (diff < 0) return invalid("XP went down. XP keeps counting up through level-ups, so check the numbers.");

  if (after.level > before.level) {
    const target = before.required ?? reqFor(before.level);
    if (target !== null && after.exp < target) {
      return invalid(`You levelled up, so XP should be at least ${target} (the old target). Check the numbers.`);
    }
    return {
      status: "exact", exp: diff, atLeast: diff, missingLevels: [],
      breakdown: [{ level: after.level, amount: diff, note: `${before.exp} → ${after.exp} (LVL ${before.level} → ${after.level})` }]
    };
  }
  return {
    status: "exact", exp: diff, atLeast: diff, missingLevels: [],
    breakdown: [{ level: before.level, amount: diff, note: `${before.exp} → ${after.exp} within level ${before.level}` }]
  };
}

export interface ExpProjection {
  status: "exact" | "incomplete";
  state: CharacterState | null;
  missingLevels: number[];
  levelsGained: number;
}

/** Predicts the character state after gaining `gain` XP (used to preview a purchase). */
export function applyExp(start: CharacterState, gain: number, reqFor: ReqFn): ExpProjection {
  let level = start.level;
  const exp = start.exp + gain;
  let req = start.required ?? reqFor(level);
  for (let guard = 0; guard < 10000; guard++) {
    if (req === null) return { status: "incomplete", state: null, missingLevels: [level], levelsGained: level - start.level };
    if (exp < req) break;
    level += 1;
    req = reqFor(level);
  }
  return { status: "exact", state: { level, exp, required: req }, missingLevels: [], levelsGained: level - start.level };
}

export interface GainResult {
  level: number;
  exp: number;
  /** XP target at the new level, or null if nobody has recorded it yet (ask the player). */
  required: number | null;
  levelsGained: number;
}

/**
 * Adds XP to a character the way the game does: XP is a running total. When it reaches the
 * target the character levels up and the target moves up; XP is NOT reduced
 * (LVL 1 at 150/200 + 100 → LVL 2 at 250/400).
 * If the next level's target is unknown we stop there and return required = null;
 * once the player types it in, call again with gain 0 to finish any further level-ups.
 */
export function addXp(start: CharacterState, gain: number, reqFor: ReqFn): GainResult {
  if (start.required === null) throw new Error("Current XP needed is required");
  let level = start.level;
  const exp = start.exp + gain;
  let req: number | null = start.required;
  while (req !== null && exp >= req) {
    level += 1;
    req = reqFor(level);
  }
  return { level, exp, required: req, levelsGained: level - start.level };
}
