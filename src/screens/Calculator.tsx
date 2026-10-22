import { useEffect, useMemo, useState } from "react";
import { planRow } from "../domain/calc";
import { BOTNET_TIERS, getEntry } from "../domain/catalog";
import { addXp } from "../domain/exp";
import { charTarget } from "../domain/formulas";
import type { CatalogEntry } from "../domain/types";
import { useApp } from "../state";
import { fmt, parseWhole } from "../ui/components";

// A free calculator: any start and end levels, nothing taken from your device.
// Order the game uses: hardware, then software, then one-time items.
const ORDER = ["device", "network", "botnet", "firewall", "password_encryptor", "antivirus", "proxy", "trace",
  "bypasser", "password_cracker", "spam", "siphon", "rootkit", "keygen", "notepad", "message_encryptor"];
const SAVE_KEY = "hedb.calculator";

type Field = { from: string; to: string };

function load(): { fields: Record<string, Field>; lvl: string; xp: string } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* private mode etc. */ }
  return { fields: {}, lvl: "", xp: "" };
}

function LevelInput({ label, value, onChange, entry }: { label: string; value: string; onChange: (v: string) => void; entry: CatalogEntry }) {
  if (entry.id === "botnet") {
    return (
      <label className="calc2-field">
        <span>{label}</span>
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {BOTNET_TIERS.map((t, i) => <option key={t.name} value={i + 1}>{t.name} · {t.slots} slots</option>)}
        </select>
      </label>
    );
  }
  return (
    <label className="calc2-field">
      <span>{label}</span>
      <input className="input mono" inputMode="numeric" pattern="[0-9]*" placeholder="—" value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))} />
    </label>
  );
}

export default function Calculator() {
  const { kb } = useApp();
  const saved = useMemo(load, []);
  const [fields, setFields] = useState<Record<string, Field>>(saved.fields);
  const [lvl, setLvl] = useState(saved.lvl);
  const [xp, setXp] = useState(saved.xp);

  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ fields, lvl, xp })); } catch { /* ignore */ }
  }, [fields, lvl, xp]);

  const set = (id: string, k: keyof Field, v: string) => setFields((f) => ({ ...f, [id]: { ...(f[id] ?? { from: "", to: "" }), [k]: v } }));

  const rows = ORDER.map((id) => {
    const e = getEntry(id);
    const f = fields[id] ?? { from: "", to: "" };
    if (e.kind === "one_time") {
      const buying = f.to === "1";
      return { e, f, buying, error: null as string | null, plan: buying ? planRow(kb, id, 0, 1) : null };
    }
    const from = parseWhole(f.from);
    const to = parseWhole(f.to);
    let error: string | null = null;
    if (from !== null && to !== null) {
      if (to <= from) error = "Ending level must be higher than starting level";
      else if (e.maxLevel !== null && to > e.maxLevel) error = `${e.name} maxes out at level ${e.maxLevel}`;
    }
    const plan = from !== null && to !== null && !error ? planRow(kb, id, from, to) : null;
    return { e, f, buying: false, error, plan };
  });

  const used = rows.filter((r) => r.plan);
  const sum = (pick: (p: NonNullable<(typeof rows)[number]["plan"]>) => number | null) => {
    let t = 0, partial = false;
    for (const r of used) { const v = pick(r.plan!); if (v === null) partial = true; else t += v; }
    return { t, partial };
  };
  const storeCost = sum((p) => p.store.cost);
  const keyCost = sum((p) => (p.key ? p.key.cost : p.store.cost));
  const singleCost = sum((p) => (p.singleKeys ? p.singleKeys.cost : p.store.cost));
  const keygenRow = used.find((r) => r.e.id === "keygen");
  const keygenEnd = keygenRow?.plan ? keygenRow.plan.to : null;
  const oneAtATimeXp = sum((p) => p.store.xp);
  const bigJumpXp = sum((p) => (p.key ? p.key.xp : p.store.xp));
  const anyKey = used.some((r) => r.plan!.key);
  const maxKeygen = Math.max(0, ...used.filter((r) => r.plan!.key).map((r) => r.plan!.to));

  const level = parseWhole(lvl);
  const startXp = parseWhole(xp) ?? 0;
  const reqFor = (l: number) => charTarget(l);
  const start = level !== null && level >= 1 ? { level, exp: startXp, required: charTarget(level) } : null;
  const startOk = start && start.required !== null && start.exp < start.required;
  const end = (gain: number) => (startOk ? addXp(start!, gain, reqFor) : null);
  const endA = end(oneAtATimeXp.t);
  const endB = end(bigJumpXp.t);

  return (
    <div className="screen">
      <h1>Calculator</h1>
      <p className="lead">Work out any upgrade: enter a starting and ending level for whatever you're buying. Nothing here touches your device.</p>

      {rows.map(({ e, f, buying, error, plan }) => (
        <section key={e.id} className="calc2-box" aria-label={e.name}>
          <div className="calc2-title">{e.name}</div>
          {e.kind === "one_time" ? (
            <label className="switch"><input type="checkbox" checked={buying} onChange={(ev) => set(e.id, "to", ev.target.checked ? "1" : "")} /><span>Buying it</span></label>
          ) : (
            <div className="calc2-pair">
              <LevelInput label="Starting level" value={f.from} onChange={(v) => set(e.id, "from", v)} entry={e} />
              <LevelInput label="Ending level" value={f.to} onChange={(v) => set(e.id, "to", v)} entry={e} />
            </div>
          )}
          {error && <div className="bad-text small">{error}</div>}
          {plan && (() => {
            const n = plan.to - plan.from;
            const noKey = e.id === "keygen" ? "Keygen can't be downloaded" : e.kind === "one_time" ? "Store only" : "Store only (hardware)";
            return (
              <div className="calc2-three">
                <div className="calc2-cost">
                  <span>Store</span>
                  <b className="mono">{plan.store.cost === null ? "?" : fmt(plan.store.cost)}</b>
                  <span className="hint mono">{plan.store.xp === null ? "XP ?" : `+${fmt(plan.store.xp)} XP`}</span>
                </div>
                <div className="calc2-cost">
                  <span>1-level keys</span>
                  {plan.singleKeys ? (
                    <>
                      <b className="mono">{plan.singleKeys.cost === null ? "?" : fmt(plan.singleKeys.cost)}</b>
                      <span className="hint mono">{plan.singleKeys.xp === null ? "XP ?" : `+${fmt(plan.singleKeys.xp)} XP`} · {n} key{n === 1 ? "" : "s"}</span>
                    </>
                  ) : <span className="hint">{noKey}</span>}
                </div>
                <div className="calc2-cost">
                  <span>Key big jump</span>
                  {plan.key ? (
                    <>
                      <b className="mono">{plan.key.cost === null ? "?" : fmt(plan.key.cost)}</b>
                      <span className="hint mono">{plan.key.xp === null ? "XP ?" : `+${fmt(plan.key.xp)} XP`} · {plan.from}→{plan.to}</span>
                    </>
                  ) : <span className="hint">{noKey}</span>}
                </div>
              </div>
            );
          })()}
          {plan?.key && plan.to - plan.from >= 1 && <div className="hint">Keys need Keygen {plan.key.keygenNeeded}+{plan.to - plan.from === 1 ? " (1 level: both key options are the same key)" : ""}</div>}
        </section>
      ))}

      <section className="calc2-box calc2-total" aria-label="Totals">
        <div className="calc2-title">Total cost</div>
        <div className="calc2-three">
          <div className="calc2-cost"><span>Store</span><b className="mono big-num">{storeCost.partial ? "≥ " : ""}{fmt(storeCost.t)}</b></div>
          <div className="calc2-cost"><span>1-level keys</span><b className="mono big-num">{singleCost.partial ? "≥ " : ""}{fmt(singleCost.t)}</b></div>
          <div className="calc2-cost"><span>Key big jumps</span><b className="mono big-num">{keyCost.partial ? "≥ " : ""}{fmt(keyCost.t)}</b></div>
        </div>
        <p className="hint">Store and 1-level keys give the same XP; big jumps give much less (see Ending level).</p>
        {anyKey && <p className="hint">Key totals use the store price for things that can't be downloaded. Keys need a Keygen level at least as high as the level they reach: up to {maxKeygen} here{keygenEnd !== null && keygenEnd >= maxKeygen ? " (your Keygen box covers it)" : ". Add Keygen above to include what raising it costs"}.</p>}
        {!used.length && <p className="hint">Enter a starting and ending level above to see totals.</p>}
      </section>

      <section className="calc2-box calc2-total" aria-label="Ending level">
        <div className="calc2-title">Ending level</div>
        <div className="calc2-pair">
          <label className="calc2-field"><span>Your level</span>
            <input className="input mono" inputMode="numeric" pattern="[0-9]*" placeholder="LVL" value={lvl} onChange={(e) => setLvl(e.target.value.replace(/[^\d]/g, ""))} />
          </label>
          <label className="calc2-field"><span>Your XP (optional)</span>
            <input className="input mono" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={xp} onChange={(e) => setXp(e.target.value.replace(/[^\d]/g, ""))} />
          </label>
        </div>
        {start && start.required !== null && <div className="hint mono">Now: LVL {start.level} · {fmt(start.exp)} / {fmt(start.required)}{xp === "" ? " (XP taken as 0, so this is less exact)" : ""}</div>}
        {start && !startOk && <div className="bad-text small">XP must be less than {fmt(start.required)} at LVL {start.level}.</div>}
        <div className="calc2-pair">
          <div className="calc2-cost">
            <span>Store or 1-level keys</span>
            <b className="mono big-num">{endA ? `LVL ${endA.level}` : "—"}</b>
            {endA && <span className="hint mono">{oneAtATimeXp.partial ? "≥ " : ""}+{fmt(oneAtATimeXp.t)} XP · {fmt(endA.exp)} / {fmt(endA.required)}</span>}
          </div>
          <div className="calc2-cost">
            <span>Key big jumps</span>
            <b className="mono big-num">{endB ? `LVL ${endB.level}` : "—"}</b>
            {endB && <span className="hint mono">{bigJumpXp.partial ? "≥ " : ""}+{fmt(bigJumpXp.t)} XP · {fmt(endB.exp)} / {fmt(endB.required)}</span>}
          </div>
        </div>
        <p className="hint">The store and single-level keys give the same XP, so they share a result. A key that jumps several levels only gives the XP of the level it lands on (confirmed: Password Cracker 2 → 4 gave +1,244, the Lv 4 XP).</p>
      </section>

      {(used.length > 0 || lvl || xp) && (
        <button className="btn ghost full" onClick={() => { setFields({}); setLvl(""); setXp(""); }}>Clear everything</button>
      )}
    </div>
  );
}
