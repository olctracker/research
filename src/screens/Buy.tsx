import { useMemo, useState } from "react";
import { newId } from "../data/repository";
import { CATALOG, CATEGORY_LABEL, getEntry, methodsFor } from "../domain/catalog";
import { applyExp, inferExpGained } from "../domain/exp";
import { methodLabel } from "../domain/knowledge";
import { missingKey, MissingKind, planPurchase, PurchasePlan, totalsWithEntered } from "../domain/purchase";
import { buildRecord, Candidate, RecordResult } from "../domain/record";
import type { Category, Method, PlayerState } from "../domain/types";
import { useApp } from "../state";
import { CharacterForm, CharDraft, parseDraft } from "../ui/CharacterForm";
import { Card, fmt, Notice, NumberField, parseWhole, Segmented, Stepper, ValueCell } from "../ui/components";
import { go } from "../ui/router";

type Step = "pick" | "details" | "confirm" | "after" | "share";
const GROUPS: Category[] = ["core", "defensive", "offensive", "virus", "utility", "one_time"];

export default function Buy() {
  const app = useApp();
  const player = app.player!;
  const [step, setStep] = useState<Step>("pick");
  const [upgradeId, setUpgradeId] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>("store");
  const [target, setTarget] = useState(1);
  const [enteredText, setEnteredText] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [after, setAfter] = useState<CharDraft>({ level: "", exp: "", required: "" });
  const [result, setResult] = useState<RecordResult | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  const entry = upgradeId ? getEntry(upgradeId) : null;
  const current = entry ? player.levels[entry.id] ?? entry.startLevel : 0;
  const keygen = player.levels.keygen ?? 0;
  const reqFor = app.kb.reqFn();

  const plan: PurchasePlan | null = useMemo(() => entry
    ? planPurchase({ entry, method, currentLevel: current, targetLevel: target, keygenLevel: keygen, kb: app.kb })
    : null, [entry, method, current, target, keygen, app.kb]);

  const entered = useMemo(() => {
    const out: Record<string, number | undefined> = {};
    for (const [k, v] of Object.entries(enteredText)) { const n = parseWhole(v); if (n !== null) out[k] = n; }
    return out;
  }, [enteredText]);

  const totals = plan ? totalsWithEntered(plan, entered) : { cost: null, exp: null };

  function pick(id: string) {
    const e = getEntry(id);
    const lvl = player.levels[id] ?? e.startLevel;
    setUpgradeId(id);
    setMethod("store");
    setTarget(e.kind === "one_time" ? 1 : lvl + 1);
    setEnteredText({}); setNotes(""); setErr(null); setResult(null); setShared(null);
    setStep("details");
  }

  function reset() {
    setStep("pick"); setUpgradeId(null); setResult(null); setShared(null); setErr(null);
    setAfter({ level: "", exp: "", required: "" });
  }

  // ---------- step 1 ----------
  if (step === "pick" || !entry || !plan) {
    return (
      <div className="screen">
        <h1>Record a purchase</h1>
        <p className="lead">Pick the upgrade. Your recorded level is on the right.</p>
        {GROUPS.map((g) => (
          <Card key={g} title={CATEGORY_LABEL[g]}>
            <ul className="pick-list">
              {CATALOG.filter((e) => e.category === g).map((e) => {
                const lvl = player.levels[e.id] ?? e.startLevel;
                const maxed = e.maxLevel !== null && lvl >= e.maxLevel;
                return (
                  <li key={e.id}>
                    <button className="pick" disabled={maxed} onClick={() => pick(e.id)}>
                      <span>{e.name}</span>
                      <span className="mono muted">
                        {e.kind === "one_time" ? (lvl >= 1 ? "Owned" : "Not owned") : maxed ? `Max ${lvl}` : `Lv ${lvl}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    );
  }

  const oneTime = entry.kind === "one_time";
  const priceKind: MissingKind = method === "download" ? "download_price" : oneTime ? "one_time_price" : "store_price";
  const expKind: MissingKind = method === "download" ? "download_exp" : oneTime ? "one_time_exp" : "store_exp";
  const setEntered = (k: string, v: string) => setEnteredText((m) => ({ ...m, [k]: v }));

  // ---------- step 2: method, destination, data check ----------
  if (step === "details") {
    const methods = methodsFor(entry);
    return (
      <div className="screen">
        <button className="link" onClick={reset}>‹ Change upgrade</button>
        <h1>{entry.name}</h1>
        <p className="lead">{oneTime ? (current >= 1 ? "Already purchased" : "One-time purchase") : `You have level ${current}`}</p>

        <Card title="How are you buying it?">
          <Segmented label="Purchase method" value={method} onChange={(m) => { setMethod(m); setEnteredText({}); }}
            options={[
              { value: "store", label: "Store", disabled: !methods.includes("store") },
              { value: "download", label: "Download", disabled: !methods.includes("download") }
            ]} />
          {!entry.download && <div className="hint">{entry.name} can't be downloaded from other players.</div>}
          {!oneTime && (
            <div className="row target-row">
              <div className="grow">
                <div className="row-title">Destination level</div>
                <div className="hint">{method === "store" ? `Buys ${Math.max(0, target - current)} level(s), one at a time` : "Download jumps straight to this level"}</div>
              </div>
              <Stepper label="Destination level" value={target} min={current + 1} max={entry.maxLevel} onChange={setTarget} />
            </div>
          )}
          {method === "download" && (
            <div className="hint">Your Keygen: <b className="mono">{keygen}</b> — downloads up to level {keygen} are allowed.</div>
          )}
        </Card>

        {plan.errors.map((e) => <Notice key={e} tone="bad">{e}</Notice>)}

        {plan.errors.length === 0 && (
          <Card title="Costs and EXP">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{method === "download" ? "Levels" : "Level"}</th><th>Cost</th><th>EXP</th></tr></thead>
                <tbody>
                  {plan.lines.map((l) => {
                    const ck = missingKey({ kind: priceKind, fromLevel: l.fromLevel, toLevel: l.toLevel });
                    const ek = missingKey({ kind: expKind, fromLevel: l.fromLevel, toLevel: l.toLevel });
                    const needCost = l.cost.value === null;
                    const estimate = l.costSource === "component_sum";
                    return (
                      <tr key={ck}>
                        <td className="mono">{method === "download" ? `${l.fromLevel}→${l.toLevel}` : oneTime ? "—" : l.toLevel}</td>
                        <td>
                          {!needCost && <ValueCell l={l.cost} estimate={estimate} />}
                          {(needCost || estimate) && (
                            <NumberField compact label={estimate ? "Actual total (optional)" : needCost && l.cost.reliability === "conflict" ? "What did it cost?" : "Price in game"}
                              value={enteredText[ck] ?? ""} onChange={(v) => setEntered(ck, v)} placeholder="e.g. 600" />
                          )}
                        </td>
                        <td>
                          {l.exp.value !== null ? <ValueCell l={l.exp} /> : (
                            <NumberField compact label="EXP (if shown)" value={enteredText[ek] ?? ""} onChange={(v) => setEntered(ek, v)} placeholder="optional" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr><th>Total</th><th className="mono">{fmt(totals.cost)}</th><th className="mono">{totals.exp !== null ? `+${fmt(totals.exp)}` : "?"}</th></tr>
                </tfoot>
              </table>
            </div>
            {plan.missing.length > 0 && (
              <Notice tone="warn">
                <b>Missing from the database:</b>
                <ul className="tight">{plan.missing.map((m) => <li key={missingKey(m)}>{m.label}{m.reason === "conflict" ? " (records conflict)" : ""}</li>)}</ul>
                Fill in what the game shows. Missing EXP can usually be worked out from your character screen after buying.
              </Notice>
            )}
            {plan.usesUnverified && <Notice tone="info">Some values have only been seen once, so treat them as unverified.</Notice>}
            {plan.warnings.map((w) => <Notice key={w} tone="info">{w}</Notice>)}
          </Card>
        )}

        <div className="sticky-actions">
          <button className="btn primary grow" disabled={plan.errors.length > 0} onClick={() => setStep("confirm")}>Review</button>
        </div>
      </div>
    );
  }

  // ---------- step 4: confirm ----------
  if (step === "confirm") {
    const projection = totals.exp !== null ? applyExp(player.character, totals.exp, reqFor) : null;
    return (
      <div className="screen">
        <button className="link" onClick={() => setStep("details")}>‹ Back</button>
        <h1>Confirm</h1>
        <Card>
          <dl className="summary">
            <dt>Upgrade</dt><dd>{entry.name}</dd>
            <dt>Method</dt><dd>{methodLabel(method)}</dd>
            {!oneTime && <><dt>Levels</dt><dd className="mono">{current} → {target} (+{plan.levelsGained})</dd></>}
            <dt>Cost</dt><dd className="mono">{fmt(totals.cost)}{totals.cost === null && <span className="muted"> unknown</span>}</dd>
            <dt>Expected EXP</dt><dd className="mono">{totals.exp !== null ? `+${fmt(totals.exp)}` : "unknown"}</dd>
            {projection?.status === "exact" && projection.state && (
              <><dt>Expected result</dt><dd className="mono">Level {projection.state.level}, {fmt(projection.state.exp)} EXP</dd></>
            )}
          </dl>
          {plan.usesUnverified && <Notice tone="info">Based partly on unverified data.</Notice>}
        </Card>
        <div className="field">
          <label htmlFor="notes">Notes (optional)</label>
          <input id="notes" className="input" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything unusual about this purchase" />
        </div>
        <Notice tone="warn">Buy it in the game first. Nothing is recorded until you confirm and enter your new stats.</Notice>
        <div className="sticky-actions">
          <button className="btn primary grow" onClick={() => {
            setAfter({ level: String(player.character.level), exp: "", required: "" });
            setStep("after");
          }}>I bought it in the game</button>
        </div>
      </div>
    );
  }

  // ---------- step 5: new character stats ----------
  if (step === "after") {
    const parsed = parseDraft(after);
    const inf = parsed.state && !parsed.error ? inferExpGained(player.character, parsed.state, reqFor) : null;

    async function save() {
      if (!parsed.state || parsed.error) { setErr(parsed.error); return; }
      const res = buildRecord({
        plan: plan!, entered, before: player.character, after: parsed.state, keygenLevel: method === "download" ? keygen : null,
        kb: app.kb, reqFor, contributor: app.user.username, notes, now: new Date().toISOString(), newId
      });
      if (res.inference.status === "invalid") { setErr(res.inference.error ?? "Check the numbers"); return; }
      const next: PlayerState = {
        ...player,
        character: parsed.state,
        levels: { ...player.levels, [entry!.id]: plan!.toLevel },
        updatedAt: res.record.createdAt
      };
      setBusy(true); setErr(null);
      try {
        await app.recordPurchase(res.record, next);
        setResult(res);
        setChecked(res.candidates.map((c) => c.checked));
        setStep("share");
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
      finally { setBusy(false); }
    }

    return (
      <div className="screen">
        <button className="link" onClick={() => setStep("confirm")}>‹ Back</button>
        <h1>Your new stats</h1>
        <p className="lead">Type exactly what the game shows now. Before: level {player.character.level}, {fmt(player.character.exp)}/{player.character.required !== null ? fmt(player.character.required) : "?"} EXP.</p>
        <Card>
          <CharacterForm draft={after} onChange={setAfter} autoFocus />
          {parsed.error && (after.exp !== "") && <Notice tone="bad">{parsed.error}</Notice>}
          {inf?.status === "exact" && (
            <Notice tone="good">
              <b>+{fmt(inf.exp)} EXP earned</b>
              <ul className="tight">{inf.breakdown.map((b, i) => <li key={i}>{fmt(b.amount)} — {b.note}</li>)}</ul>
              {totals.exp !== null && inf.exp !== totals.exp && <div>Expected +{fmt(totals.exp)}. The difference will be flagged.</div>}
            </Notice>
          )}
          {inf?.status === "incomplete" && (
            <Notice tone="warn">At least {fmt(inf.atLeast)} EXP. Exact amount unknown because the EXP needed for level {inf.missingLevels.join(", ")} isn't known.</Notice>
          )}
          {inf?.status === "invalid" && <Notice tone="bad">{inf.error}</Notice>}
        </Card>
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="sticky-actions">
          <button className="btn primary grow" disabled={busy || !parsed.state || !!parsed.error} onClick={save}>{busy ? "Saving…" : "Save purchase"}</button>
        </div>
      </div>
    );
  }

  // ---------- step 6/7: saved, offer to share ----------
  const r = result!;
  const selected = r.candidates.filter((_, i) => checked[i]);

  async function share() {
    setBusy(true); setErr(null);
    try {
      await app.contribute({
        prices: selected.flatMap((c: Candidate) => (c.type === "price" ? [c.data] : [])),
        exp: selected.flatMap((c: Candidate) => (c.type === "exp" ? [c.data] : [])),
        levelReqs: selected.flatMap((c: Candidate) => (c.type === "level_req" ? [c.data] : []))
      });
      setShared(`Shared ${selected.length} observation${selected.length === 1 ? "" : "s"}. Thank you!`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="screen">
      <h1>Saved</h1>
      <Card>
        <dl className="summary">
          <dt>{entry.name}</dt><dd className="mono">{oneTime ? "Purchased" : `${r.record.fromLevel} → ${r.record.toLevel}`}</dd>
          <dt>Cost</dt><dd className="mono">{fmt(r.record.cost)}</dd>
          <dt>EXP earned</dt><dd className="mono">{r.record.expEarned !== null ? `+${fmt(r.record.expEarned)}` : "not exact"}</dd>
          <dt>Confidence</dt><dd>{CONF[r.record.confidence]}</dd>
        </dl>
      </Card>
      {r.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}

      {r.candidates.length > 0 && !shared && (
        <Card title={app.repo.mode === "supabase" ? "Share with the research database?" : "Add to your local research?"}>
          <p className="hint">These are saved as plain observations. They only become “confirmed” after review.</p>
          <ul className="rows">
            {r.candidates.map((c, i) => (
              <li key={c.data.id} className="row">
                <label className="check grow">
                  <input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked((arr) => arr.map((v, j) => (j === i ? e.target.checked : v)))} />
                  <span><span className="row-title">{c.label}</span><span className="hint block">{c.why}</span></span>
                </label>
              </li>
            ))}
          </ul>
          {err && <Notice tone="bad">{err}</Notice>}
          <div className="btn-row">
            <button className="btn ghost" onClick={() => go("home")}>Skip</button>
            <button className="btn primary grow" disabled={busy || selected.length === 0} onClick={share}>{busy ? "Sharing…" : `Share ${selected.length}`}</button>
          </div>
        </Card>
      )}
      {r.candidates.length === 0 && <p className="muted">Nothing new to share from this purchase.</p>}
      {shared && <Notice tone="good">{shared}</Notice>}
      {(shared || r.candidates.length === 0) && (
        <div className="btn-row">
          <button className="btn ghost grow" onClick={reset}>Record another</button>
          <button className="btn primary grow" onClick={() => go("home")}>Done</button>
        </div>
      )}
    </div>
  );
}

export const CONF: Record<string, string> = {
  exact: "Exact",
  uses_unverified: "Uses unverified data",
  incomplete: "Incomplete",
  estimate: "Estimate"
};
