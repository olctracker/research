import { useState } from "react";
import { BOTNET_TIERS, CATALOG, CATEGORY_LABEL, defaultLevels, validateLevel } from "../domain/catalog";
import type { Category, PlayerState } from "../domain/types";
import { newId } from "../data/repository";
import { newLevelReqs } from "../domain/record";
import { useApp } from "../state";
import { CharacterForm, draftFrom, parseDraft } from "../ui/CharacterForm";
import { Card, Notice, Stepper } from "../ui/components";

const GROUPS: Category[] = ["core", "defensive", "offensive", "virus", "utility"];

export default function Device({ onDone, first = false }: { onDone: () => void; first?: boolean }) {
  const { player, savePlayer, user, observations, contribute, kb } = useApp();
  const [char, setChar] = useState(draftFrom(player?.character));
  const [levels, setLevels] = useState<Record<string, number>>({ ...defaultLevels(), ...(player?.levels ?? {}) });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reboots, setReboots] = useState(player?.reboots ?? 0);
  const [rebootNote, setRebootNote] = useState(false);

  const setLevel = (id: string, v: number) => { setSaved(false); setLevels((l) => ({ ...l, [id]: v })); };

  /** A reboot puts you back at LVL 1 with starting hardware and software. Fills the form; Save makes it real. */
  function rebooted() {
    if (!confirm(`Record a reboot?\n\nThis sets Reboots to ${reboots + 1}, your character to LVL 1, and every program back to its starting level. Check the numbers, then tap Save.`)) return;
    setReboots(reboots + 1);
    const req = kb.reqFn()(1);
    setChar({ level: "1", exp: "0", required: req !== null ? String(req) : "" });
    setLevels((l) => {
      const next = { ...l };
      for (const e of CATALOG) if (e.kind === "level") next[e.id] = e.startLevel;
      return next;
    });
    setSaved(false);
    setRebootNote(true);
  }

  async function save() {
    const { state, error: e } = parseDraft(char);
    if (!state || e) { setError(e); return; }
    for (const entry of CATALOG) {
      const msg = validateLevel(entry, levels[entry.id] ?? 0);
      if (msg) { setError(`${entry.name}: ${msg}`); return; }
    }
    const next: PlayerState = {
      alias: user.username, character: state, levels, setupComplete: true, updatedAt: new Date().toISOString(), reboots
    };
    setBusy(true);
    try {
      await savePlayer(next);
      // Share this level's "XP needed" so the Data Table and level-up maths can use it.
      const reqs = newLevelReqs([state], observations, user.username, next.updatedAt, newId);
      if (reqs.length) await contribute({ prices: [], exp: [], levelReqs: reqs }).catch(() => { /* saving the device still worked */ });
      setError(null);
      setRebootNote(false);
      if (first) onDone(); else setSaved(true);
    }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="screen">
      <h1>{first ? "Set up your device" : "My Device"}</h1>
      <p className="lead">
        {first
          ? `Welcome, ${user.username}. Enter what your game shows right now — you don't have to start at level 1.`
          : "Keep this matching your game. Use it if you bought something without using Purchase, or your XP changed from missions and hacks. Changes here aren't counted as purchases."}
      </p>

      <Card title="Character">
        <CharacterForm draft={char} onChange={(d) => { setSaved(false); setChar(d); }} />
        <div className="hint">Copy these from your game home screen: LVL, then XP progress (for example 5870 / 17993). Or paste them in the top box.</div>
        <div className="row reboot-row">
          <div className="grow">
            <div className="row-title">Reboots</div>
            <div className="hint">The R number on your game home screen (R3 = 3). 0 if you've never rebooted.</div>
          </div>
          <Stepper label="Reboots" value={reboots} min={0} max={999} onChange={(v) => { setSaved(false); setReboots(v); }} />
        </div>
        {!first && <button className="btn ghost full" onClick={rebooted}>I just rebooted</button>}
        {rebootNote && (
          <Notice tone="warn">
            Reboot filled in: LVL 1 and starting levels. Enter the XP numbers your game shows now.
            One-time purchases were left as they were — switch them off below if the reboot removed them. Then tap <b>Save my device</b>.
          </Notice>
        )}
      </Card>

      {GROUPS.map((g) => (
        <Card key={g} title={CATEGORY_LABEL[g]}>
          <ul className="rows">
            {CATALOG.filter((e) => e.category === g).map((e) => (
              <li key={e.id} className="row">
                <div className="grow">
                  <div className="row-title">{e.name}</div>
                  <div className="hint">{e.id === "botnet" ? "Tier name from the Apps screen" : `${e.maxLevel !== null ? `Max ${e.maxLevel}` : "No known cap"} · new game starts at ${e.startLevel}`}</div>
                </div>
                {e.id === "botnet" ? (
                  <select className="input tier-select" aria-label="Botnet tier" value={levels.botnet ?? 1} onChange={(ev) => setLevel("botnet", Number(ev.target.value))}>
                    {BOTNET_TIERS.map((t, i) => <option key={t.name} value={i + 1}>{t.name} · {t.slots} slots</option>)}
                  </select>
                ) : (
                  <Stepper label={`${e.name} level`} value={levels[e.id] ?? e.startLevel} min={0} max={e.maxLevel} onChange={(v) => setLevel(e.id, v)} />
                )}
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
        <button className="btn primary grow" disabled={busy} onClick={save}>
          {busy ? "Saving…" : saved ? "Saved ✓" : first ? "Save and continue" : "Save my device"}
        </button>
      </div>
    </div>
  );
}
