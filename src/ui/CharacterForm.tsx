import { validateCharacter } from "../domain/exp";
import type { CharacterState } from "../domain/types";
import { NumberField, parseWhole } from "./components";

export interface CharDraft { level: string; exp: string; required: string }

export const draftFrom = (c: CharacterState | null | undefined): CharDraft => ({
  level: c ? String(c.level) : "",
  exp: c ? String(c.exp) : "",
  required: c?.required != null ? String(c.required) : ""
});

/** Returns a parsed state or an error message. Empty "required" is allowed (unknown). */
export function parseDraft(d: CharDraft): { state: CharacterState | null; error: string | null } {
  const level = parseWhole(d.level);
  const exp = parseWhole(d.exp);
  const required = d.required.trim() === "" ? null : parseWhole(d.required);
  if (level === null) return { state: null, error: "Enter your character level" };
  if (exp === null) return { state: null, error: "Enter your current EXP (0 if none)" };
  if (d.required.trim() !== "" && required === null) return { state: null, error: "Next-level EXP must be a whole number" };
  const state = { level, exp, required };
  return { state, error: validateCharacter(state) };
}

export function CharacterForm({ draft, onChange, autoFocus }: { draft: CharDraft; onChange: (d: CharDraft) => void; autoFocus?: boolean }) {
  return (
    <div className="grid3">
      <NumberField label="Level" value={draft.level} onChange={(v) => onChange({ ...draft, level: v })} autoFocus={autoFocus} compact />
      <NumberField label="EXP now" value={draft.exp} onChange={(v) => onChange({ ...draft, exp: v })} compact />
      <NumberField label="EXP for next" value={draft.required} onChange={(v) => onChange({ ...draft, required: v })} placeholder="if shown" compact />
    </div>
  );
}
