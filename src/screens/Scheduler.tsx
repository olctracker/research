import { useMemo, useState } from "react";
import { BuyMethod, planRow, planTotals } from "../domain/calc";
import { BOTNET_TIERS, CATALOG, CATEGORY_LABEL, getEntry, levelName } from "../domain/catalog";
import type { Category } from "../domain/types";
import { useApp } from "../state";
import { Card, fmt, Notice, parseWhole, Stepper } from "../ui/components";

const GROUPS: Category[] = ["core", "defensive", "offensive", "virus", "utility", "one_time"];

function OptionButton({ on, title, cost, xp, extra, warn, onClick }: {
  on: boolean; title: string; cost: number | null; xp: number | null; extra?: string; warn?: string; onClick: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`calc-opt${on ? " on" : ""}`} onClick={onClick}>
      <span className="calc-opt-title">{title}</span>
      <span className="mono calc-opt-cost">{cost === null ? "?" : fmt(cost)}</span>
      <span className="hint mono">{xp === null ? "XP ?" : `+${fmt(xp)} XP`}</span>
      {extra && <span className="hint">{extra}</span>}
      {warn && <span className="warn-text small">{warn}</span>}
    </button>
  );
}

export default function Scheduler() {
  const { player, kb } = useApp();
  const levels = player?.levels ?? {};
  const cur = (id: string) => levels[id] ?? getEntry(id).startLevel;
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [choice, setChoice] = useState<Record<string, BuyMethod>>({});
  const [wallet, setWallet] = useState("");
  const target = (id: string) => Math.max(targets[id] ?? cur(id), cur(id));

  const rows = useMemo(
    () => CATALOG.map((e) => planRow(kb, e.id, cur(e.id), target(e.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kb, levels, targets]
  );
  // Keys can use the Keygen level you'll have after this plan's Keygen upgrades.
  const keygenAfter = Math.max(cur("keygen"), target("keygen"));
  const totals = useMemo(
    () => (player ? planTotals(kb, rows, choice, player.character, keygenAfter) : null),
    [kb, rows, choice, player, keygenAfter]
  );
  if (!player || !totals) return null;

  const changed = rows.filter((r) => r.to > r.from);
  const money = parseWhole(wallet);
  const c = player.character;
  const set = (id: string, v: number) => setTargets((t) => ({ ...t, [id]: v }));

  return (
    <div className="screen">
      <h1>Scheduler</h1>
      <p className="lead">Pick the levels you want. See what it costs, the XP you'd get, and the level you'd end up at. Prices and XP come from crew reports and the verified formulas.</p>

      <div className="calc-summary">
        <div className="calc-sum-grid">
          <div><div className="hint">Total cost</div><div className="stat mono">{totals.partial ? "≥ " : ""}{fmt(totals.cost)}</div></div>
          <div><div className="hint">XP</div><div className="stat mono">+{fmt(totals.xp)}</div></div>
          <div>
            <div className="hint">You'd be</div>
            <div className="stat mono">LVL {totals.after?.level ?? c.level}</div>
          </div>
        </div>
        {totals.after && (
          <div className="hint mono">
            {fmt(totals.after.exp)} / {fmt(totals.after.required)}
            {totals.after.levelsGained > 0 ? ` · +${totals.after.levelsGained} level${totals.after.levelsGained === 1 ? "" : "s"} from LVL ${c.level}` : ` · now ${fmt(c.exp)} / ${fmt(c.required)}`}
          </div>
        )}
        <div className="calc-wallet">
          <label className="hint" htmlFor="calc-wallet">Crypto you have</label>
          <input id="calc-wallet" className="input mono" inputMode="numeric" placeholder="optional" value={wallet}
            onChange={(e) => setWallet(e.target.value.replace(/[^\d,]/g, ""))} />
          {money !== null && totals.cost !== null && changed.length > 0 && (
            <span className={`mono small ${money >= totals.cost ? "good-text" : "bad-text"}`}>
              {money >= totals.cost ? `${fmt(money - totals.cost)} left over` : `${fmt(totals.cost - money)} short`}
            </span>
          )}
        </div>
        {changed.length > 0 && <button className="btn sm ghost" onClick={() => { setTargets({}); setChoice({}); }}>Reset</button>}
      </div>

      {totals.keygenShort.length > 0 && (
        <Notice tone="warn">
          Keys need a Keygen level at least as high as the level you're jumping to:{" "}
          {totals.keygenShort.map((k) => `${getEntry(k.upgradeId).name} needs Keygen ${k.needs}`).join(", ")}. Your Keygen would be {keygenAfter}.
        </Notice>
      )}
      {totals.partial && <Notice tone="info">Some prices or XP aren't known yet, so the totals are the least it could be.</Notice>}

      {GROUPS.map((g) => (
        <Card key={g} title={CATEGORY_LABEL[g]}>
          <ul className="rows">
            {CATALOG.filter((e) => e.category === g).map((e) => {
              const r = rows.find((x) => x.upgradeId === e.id)!;
              const from = cur(e.id);
              const to = target(e.id);
              const oneTime = e.kind === "one_time";
              const pick = choice[e.id] ?? "store";
              return (
                <li key={e.id} className="calc-row">
                  <div className="calc-head">
                    <div className="grow">
                      <div className="row-title">{e.name}</div>
                      <div className="hint mono">
                        {oneTime ? (from >= 1 ? "Owned" : "Not owned")
                          : e.maxLevel !== null && from >= e.maxLevel ? `${levelName(e.id, from)} · max`
                          : `Now ${levelName(e.id, from)}`}
                      </div>
                    </div>
                    {oneTime ? (
                      from < 1 && (
                        <label className="switch"><input type="checkbox" checked={to >= 1} onChange={(ev) => set(e.id, ev.target.checked ? 1 : 0)} /><span>Buy</span></label>
                      )
                    ) : e.id === "botnet" ? (
                      <select className="input tier-select" aria-label="Botnet target tier" value={to} onChange={(ev) => set("botnet", Number(ev.target.value))}>
                        {BOTNET_TIERS.map((t, i) => i + 1 >= from && <option key={t.name} value={i + 1}>{t.name}</option>)}
                      </select>
                    ) : (
                      (e.maxLevel === null || from < e.maxLevel) && (
                        <Stepper label={`${e.name} target level`} value={to} min={from} max={e.maxLevel} onChange={(v) => set(e.id, v)} />
                      )
                    )}
                  </div>
                  {to > from && (
                    <div className="calc-opts" role="radiogroup" aria-label={`${e.name}: store or key`}>
                      <OptionButton on={pick === "store" || !r.key} title={oneTime ? "Store" : `Store · ${to - from} level${to - from === 1 ? "" : "s"}`}
                        cost={r.store.cost} xp={r.store.xp} onClick={() => setChoice((ch) => ({ ...ch, [e.id]: "store" }))} />
                      {r.key && (
                        <OptionButton on={pick === "key"} title={`Key · ${from} → ${to}`} cost={r.key.cost} xp={r.key.xp}
                          extra={`Needs Keygen ${r.key.keygenNeeded}${r.key.keyXpUntested ? " · XP for the landing level only" : ""}`}
                          warn={keygenAfter < r.key.keygenNeeded ? `Your Keygen would be ${keygenAfter}` : undefined}
                          onClick={() => setChoice((ch) => ({ ...ch, [e.id]: "key" }))} />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      <p className="hint">A key only works if someone has that version for you to download. The store is always available.</p>
      {changed.length > 0 && (
        <><div className="calc-bar-space" aria-hidden="true" /><div className="calc-bar" aria-live="polite">
          <span className="mono"><b>{totals.partial ? "≥ " : ""}{fmt(totals.cost)}</b> Crypto</span>
          <span className="mono">+{fmt(totals.xp)} XP</span>
          <span className="mono"><b>LVL {totals.after?.level ?? c.level}</b></span>
        </div></>
      )}
    </div>
  );
}
