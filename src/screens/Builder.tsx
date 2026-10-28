import { useEffect, useMemo, useState } from "react";
import { BUILDER_GROUPS, BUILDER_IDS, buildCharacter, endingLevel, floorLevel, MIX_LEVEL_CAP, type Sum } from "../domain/builder";
import { BOTNET_TIERS, getEntry } from "../domain/catalog";
import { charTarget } from "../domain/formulas";
import { useApp } from "../state";
import { fmt, parseWhole } from "../ui/components";

// Character Builder: set a current and end level for every upgrade and see the cost and where the account lands.
const SAVE_KEY = "hedb.builder";
type Saved = { cur: Record<string, string>; end: Record<string, string>; lvl: string; xp: string; reboot: string };

function load(): Saved {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { cur: {}, end: {}, lvl: "", xp: "", reboot: "", ...JSON.parse(raw) };
  } catch { /* private mode etc. */ }
  return { cur: {}, end: {}, lvl: "", xp: "", reboot: "" };
}

const digits = (v: string) => v.replace(/[^\d]/g, "");
const money = (s: Sum) => `${s.partial ? "≥ " : ""}${fmt(s.cost)}`;

function LevelBox({ id, label, value, placeholder, onChange }: { id: string; label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  const e = getEntry(id);
  if (id === "botnet" || e.kind === "one_time") {
    const options = id === "botnet"
      ? BOTNET_TIERS.map((t, i) => ({ v: String(i + 1), t: t.name }))
      : [{ v: "0", t: "No" }, { v: "1", t: "Yes" }];
    return (
      <label className="bld-field"><span>{label}</span>
        <select className="input" value={value} onChange={(ev) => onChange(ev.target.value)} aria-label={`${e.name} ${label}`}>
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>
      </label>
    );
  }
  return (
    <label className="bld-field"><span>{label}</span>
      <input className="input mono" inputMode="numeric" pattern="[0-9]*" value={value} placeholder={placeholder}
        aria-label={`${e.name} ${label}`} onFocus={(ev) => ev.target.select()} onChange={(ev) => onChange(digits(ev.target.value))} />
    </label>
  );
}

export default function Builder() {
  const { kb, player } = useApp();
  const saved = useMemo(load, []);
  const [cur, setCur] = useState(saved.cur);
  const [end, setEnd] = useState(saved.end);
  const [lvl, setLvl] = useState(saved.lvl);
  const [xp, setXp] = useState(saved.xp);
  const [reboot, setReboot] = useState(saved.reboot || String(player?.reboots ?? 0));
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ cur, end, lvl, xp, reboot })); } catch { /* ignore */ }
  }, [cur, end, lvl, xp, reboot]);

  // Resolve every box: empty current = lowest level, empty end = no change.
  const levels: Record<string, { from: number; to: number; error: string | null }> = {};
  for (const id of BUILDER_IDS) {
    const e = getEntry(id);
    const from = parseWhole(cur[id] ?? "") ?? floorLevel(id);
    const to = parseWhole(end[id] ?? "") ?? from;
    let error: string | null = null;
    if (e.maxLevel !== null && (from > e.maxLevel || to > e.maxLevel)) error = `Max is ${e.maxLevel}`;
    else if (from < floorLevel(id)) error = `Lowest is ${floorLevel(id)}`;
    else if (to < from) error = "End is below current";
    levels[id] = { from, to, error };
  }
  const usable = Object.fromEntries(Object.entries(levels).filter(([, l]) => !l.error));
  const r = buildCharacter(kb, usable);
  const rowOf = (id: string) => r.rows.find((x) => x.upgradeId === id);

  const keygenEnd = levels.keygen.error ? null : levels.keygen.to;
  const keygenShort = r.keygenNeeded > 0 && keygenEnd !== null && keygenEnd < r.keygenNeeded;

  const level = parseWhole(lvl) ?? 1;
  const startXp = parseWhole(xp) ?? 0;
  const target = charTarget(level);
  const xpOk = target !== null && startXp < target;
  const land = (gain: number) => (xpOk ? endingLevel(level, startXp, gain) : null);
  const oneAtATime = land(r.store.xp);
  const jump = land(r.jump.xp);
  const m2 = land(r.mix2.xp), m3 = land(r.mix3.xp);
  const capped = (l: number) => (l >= MIX_LEVEL_CAP ? `${MIX_LEVEL_CAP}+` : String(l));
  const mixText = m2 && m3
    ? (m2.level === m3.level ? capped(m2.level) : `${capped(Math.min(m2.level, m3.level))}–${capped(Math.max(m2.level, m3.level))}`).replace(/^(\d+\+)–\d+\+$/, "$1")
    : "—";
  const mixCost = r.mix2.cost === r.mix3.cost ? money(r.mix2) : `${money(r.mix3)} – ${fmt(r.mix2.cost)}`;

  function importDevice() {
    if (!player) return;
    setCur(Object.fromEntries(BUILDER_IDS.map((id) => [id, String(player.levels[id] ?? floorLevel(id))])));
    setLvl(String(player.character.level));
    setXp(String(player.character.exp));
    setReboot(String(player.reboots ?? 0));
    setNote("Current levels, account level and XP copied from My Device.");
  }
  function reset() {
    if (!confirm("Reset every current level to zero?\n\nDevice and Network go to 1 and Botnet to Free, the lowest they can be.")) return;
    setCur(Object.fromEntries(BUILDER_IDS.map((id) => [id, String(floorLevel(id))])));
    setNote("Current levels reset.");
  }

  const result = (label: string, at: ReturnType<typeof land>, cost: string, gain: Sum, sub?: string) => (
    <div className="bld-result">
      <div className="bld-result-top"><span>{label}</span><b className="mono">{at ? `LVL ${at.level}` : "—"}</b></div>
      <div className="hint mono">{cost} Crypto · {gain.partial ? "≥ " : ""}+{fmt(gain.xp)} XP{at ? ` · ${fmt(at.exp)} / ${fmt(at.required ?? 0)}` : ""}</div>
      {sub && <div className="hint">{sub}</div>}
    </div>
  );

  return (
    <div className="screen bld">
      <h1>Character Builder</h1>
      <div className="bld-toolbar">
        <button className="btn sm" onClick={importDevice} disabled={!player}>Import my device</button>
        <button className="btn sm danger" onClick={reset}>Reset</button>
      </div>
      {note && <div className="hint">{note}</div>}

      <div className="bld-layout">
        <section className="calc2-box bld-side" aria-label="Results">
          <div className="bld-pair3">
            <label className="bld-field"><span>Reboot</span>
              <select className="input" value={reboot} onChange={(e) => setReboot(e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => <option key={i} value={i}>R{i}</option>)}
              </select>
            </label>
            <label className="bld-field"><span>Account LVL</span>
              <input className="input mono" inputMode="numeric" pattern="[0-9]*" placeholder="1" value={lvl} onChange={(e) => setLvl(digits(e.target.value))} />
            </label>
            <label className="bld-field"><span>XP</span>
              <input className="input mono" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={xp} onChange={(e) => setXp(digits(e.target.value))} />
            </label>
          </div>
          {!xpOk && target !== null && <div className="bad-text small">XP must be less than {fmt(target)} at LVL {level}.</div>}
          {xpOk && <div className="hint mono">Now: LVL {level} · {fmt(startXp)} / {fmt(target!)}. Prices and XP are the same on every reboot so far.</div>}

          {result("One level at a time", oneAtATime, `Store ${money(r.store)} · 1-level keys ${money(r.singleKeys)}`, r.store,
            "Store and 1-level keys give the same XP.")}
          {result("One Keygen jump", jump, money(r.jump), r.jump, "Each app jumps straight to its end level: you get only the end level's XP.")}
          <div className="bld-result">
            <div className="bld-result-top"><span>Mix: 2–3 level jumps</span><b className="mono">{m2 && m3 ? `≈ LVL ${mixText}` : "—"}</b></div>
            <div className="hint mono">{mixCost} Crypto · +{fmt(Math.min(r.mix2.xp, r.mix3.xp))}–{fmt(Math.max(r.mix2.xp, r.mix3.xp))} XP</div>
            <div className="hint">Estimate, shown up to LVL {MIX_LEVEL_CAP}. Past {MIX_LEVEL_CAP}, apps above 40 are rarely downloadable, so it's mostly store buying.</div>
          </div>
          {keygenShort && <div className="warn-text small">Keys need Keygen {r.keygenNeeded}. Raise Keygen's end level to {r.keygenNeeded} (its cost is store only).</div>}
        </section>

        <div className="bld-main">
          {BUILDER_GROUPS.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <div className="bld-group">{g.title}</div>
              <div className="bld-grid">
                {g.ids.map((id) => {
                  const e = getEntry(id);
                  const l = levels[id];
                  const row = rowOf(id);
                  const storeOnly = !e.download;
                  return (
                    <div key={id} className={`bld-card${row ? " on" : ""}`}>
                      <div className="bld-name">{e.name}</div>
                      <div className="bld-two">
                        <LevelBox id={id} label="Current" value={cur[id] ?? ""} placeholder={id === "botnet" ? "Free" : e.kind === "one_time" ? "No" : String(floorLevel(id))}
                          onChange={(v) => setCur((c) => ({ ...c, [id]: v }))} />
                        <LevelBox id={id} label="End" value={end[id] ?? ""} placeholder="—"
                          onChange={(v) => setEnd((c) => ({ ...c, [id]: v }))} />
                      </div>
                      {l.error ? <div className="bad-text small">{l.error}</div> : (
                        <div className="bld-two bld-costs">
                          <div><span>Store</span><b className="mono">{row ? (row.store.cost === null ? "?" : fmt(row.store.cost)) : "—"}</b></div>
                          <div><span>Keygen</span><b className="mono">{storeOnly ? <span className="hint">store only</span> : row?.key ? (row.key.cost === null ? "?" : fmt(row.key.cost)) : "—"}</b></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="calc2-box calc2-total" aria-label="Totals">
            <div className="calc2-title">Totals</div>
            <div className="bld-two bld-costs bld-totals">
              <div><span>Store cost</span><b className="mono">{money(r.store)}</b></div>
              <div><span>Keygen cost (one jump)</span><b className="mono">{money(r.jump)}</b></div>
              <div><span>XP, one level at a time</span><b className="mono">+{fmt(r.store.xp)}</b></div>
              <div><span>XP, one Keygen jump</span><b className="mono">+{fmt(r.jump.xp)}</b></div>
            </div>
            <p className="hint">The Keygen total uses the store price for Device, Network, Botnet, Keygen and one-time items, since keys can't buy those.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
