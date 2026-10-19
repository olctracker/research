import { useId, useState } from "react";
import { parseHome } from "../domain/paste";
import { validateCharacter } from "../domain/exp";
import type { CharacterState } from "../domain/types";
import { parseWhole } from "./components";

export interface CharDraft { level: string; exp: string; required: string }

export const draftFrom = (c: CharacterState | null | undefined): CharDraft => ({
  level: c ? String(c.level) : "",
  exp: c ? String(c.exp) : "",
  required: c?.required != null ? String(c.required) : ""
});

/** Parses the three numbers from the game's home screen: LVL 24 · XP 5870 / 17993. */
export function parseDraft(d: CharDraft): { state: CharacterState | null; error: string | null } {
  const level = parseWhole(d.level);
  const exp = parseWhole(d.exp);
  const required = parseWhole(d.required);
  if (level === null) return { state: null, error: "Enter your level (LVL)" };
  if (exp === null) return { state: null, error: "Enter your XP (the left number)" };
  if (required === null) return { state: null, error: "Enter the XP needed (the right number)" };
  const state = { level, exp, required };
  return { state, error: validateCharacter(state) };
}

/** Mirrors the game's home screen so the numbers can be copied straight across. */
export function CharacterForm({ draft, onChange, autoFocus }: { draft: CharDraft; onChange: (d: CharDraft) => void; autoFocus?: boolean }) {
  const id = useId();
  const field = (k: keyof CharDraft, label: string, extra?: { autoFocus?: boolean; placeholder?: string }) => (
    <input
      id={`${id}-${k}`} aria-label={label} className="input mono" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
      value={draft[k]} placeholder={extra?.placeholder} autoFocus={extra?.autoFocus}
      onChange={(e) => onChange({ ...draft, [k]: e.target.value.replace(/[^\d]/g, "") })}
    />
  );
  const [quick, setQuick] = useState("");
  /** One box: type "20262 / 20978" (or "27 20262 20978"), or paste the whole home screen. */
  function onQuick(v: string) {
    setQuick(v);
    const h = parseHome(v);
    if (h.exp === null || h.required === null) return;
    onChange({ level: h.level !== null ? String(h.level) : draft.level, exp: String(h.exp), required: String(h.required) });
  }
  return (
    <>
    <label className="quick-xp">
      <span>Type or paste in one box</span>
      <input className="input mono" inputMode="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        placeholder="20262 / 20978   or   27 20262 20978" value={quick} onChange={(e) => onQuick(e.target.value)} />
    </label>
    <div className="char-form">
      <div className="char-lvl">
        <label htmlFor={`${id}-level`}>LVL</label>
        {field("level", "Level", { autoFocus, placeholder: "24" })}
      </div>
      <div className="char-xp">
        <label htmlFor={`${id}-exp`}>XP progress</label>
        <div className="char-xp-row">
          {field("exp", "XP", { placeholder: "5870" })}
          <span className="slash" aria-hidden="true">/</span>
          {field("required", "XP needed", { placeholder: "17993" })}
        </div>
      </div>
    </div>
    </>
  );
}
