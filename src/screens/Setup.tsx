import { useState } from "react";
import { CATALOG, CATEGORY_LABEL, defaultLevels, validateLevel } from "../domain/catalog";
import type { Category, PlayerState } from "../domain/types";
import { useApp } from "../state";
import { CharacterForm, draftFrom, parseDraft } from "../ui/CharacterForm";
import { Card, Notice, Stepper } from "../ui/components";

const GROUPS: Category[] = ["core", "defensive", "offensive", "virus", "utility"];

export default function Setup({ onDone }: { onDone: () => void }) {
  const { player, savePlayer, user } = useApp();
  const first = !player?.setupComplete;
  const [char, setChar] = useState(draftFrom(player?.character ?? { level: 1, exp: 0, required: null }));
  const [levels, setLevels] = useState<Record<string, number>>({ ...defaultLevels(), ...(player?.levels ?? {}) });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setLevel = (id: string, v: number) => setLevels((l) => ({ ...l, [id]: v }));

  async function save() {
    const { state, error: e } = parseDraft(char);
    if (!state || e) { setError(e); return; }
    for (const entry of CATALOG) {
      const msg = validateLevel(entry, levels[entry.id] ?? 0);
      if (msg) { setError(`${entry.name}: ${msg}`); return; }
    }
    const next: PlayerState = {
      alias: user.username, character: state, levels, setupComplete: true, updatedAt: new Date().toISOString()
    };
    setBusy(true);
    try { await savePlayer(next); onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="screen">
      <h1>{first ? "Set up your game" : "Edit game state"}</h1>
      <p className="lead">
        {first
          ? `Welcome, ${user.username}. Enter what your game shows right now — you don't have to start at level 1.`
          : "Fix any numbers that are out of date. This doesn't create a purchase or any shared data."}
      </p>


      <Card title="Character">
        <CharacterForm draft={char} onChange={setChar} />
        <div className="hint">“EXP for next” is the total EXP your current level needs. Leave it blank if you can't see it.</div>
      </Card>

      {GROUPS.map((g) => (
        <Card key={g} title={CATEGORY_LABEL[g]}>
          <ul className="rows">
            {CATALOG.filter((e) => e.category === g).map((e) => (
              <li key={e.id} className="row">
                <div className="grow">
                  <div className="row-title">{e.name}</div>
                  <div className="hint">{e.maxLevel !== null ? `Max ${e.maxLevel}` : "No known cap"} · new game starts at {e.startLevel}</div>
                </div>
                <Stepper label={`${e.name} level`} value={levels[e.id] ?? e.startLevel} min={0} max={e.maxLevel} onChange={(v) => setLevel(e.id, v)} />
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Card title="One-time purchases">
        <ul className="rows">
          {CATALOG.filter((e) => e.kind === "one_time").map((e) => (
            <li key={e.id} className="row">
              <div className="grow row-title">{e.name}</div>
              <label className="switch">
                <input type="checkbox" checked={(levels[e.id] ?? 0) >= 1} onChange={(ev) => setLevel(e.id, ev.target.checked ? 1 : 0)} />
                <span>{(levels[e.id] ?? 0) >= 1 ? "Purchased" : "Not purchased"}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>

      {error && <Notice tone="bad">{error}</Notice>}
      <div className="sticky-actions">
        {!first && <button className="btn ghost" onClick={onDone}>Cancel</button>}
        <button className="btn primary grow" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save game state"}</button>
      </div>
    </div>
  );
}
