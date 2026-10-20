import { useMemo, useState } from "react";
import { newId } from "../data/repository";
import { CATALOG, CATEGORY_LABEL, getEntry, methodsFor } from "../domain/catalog";
import { addXp, inferExpGained } from "../domain/exp";
import { isVerified, methodLabel } from "../domain/knowledge";
import { missingKey, planPurchase } from "../domain/purchase";
import { buildRecord, RecordResult } from "../domain/record";
import type { CharacterState, Category, Method, PlayerState, PriceObservation } from "../domain/types";
import { useApp } from "../state";
import { CharacterForm, CharDraft, draftFrom, parseDraft } from "../ui/CharacterForm";
import { Card, fmt, Notice, parseWhole, RelBadge, Segmented } from "../ui/components";
import { go } from "../ui/router";

type Phase = "form" | "after" | "need_req" | "done";
const GROUPS: Category[] = ["core", "defensive", "offensive", "virus", "utility", "one_time"];
const stateText = (c: CharacterState) => `LVL ${c.level} · ${fmt(c.exp)} / ${c.required !== null ? fmt(c.required) : "?"}`;

interface Done { result: RecordResult; shared: string[]; leveledUp: number }

export default function Purchase() {
  const app = useApp();
  const player = app.player!;
  const reqFor = app.kb.reqFn();
  const [upgradeId, setUpgradeId] = useState("");
  const [method, setMethod] = useState<Method>("store");
  const [priceText, setPriceText] = useState("");
  const [before, setBefore] = useState<CharDraft>(draftFrom(player.character));
  const [after, setAfter] = useState<CharDraft>({ level: "", exp: "", required: "" });
  const [pending, setPending] = useState<{ level: number; exp: number } | null>(null);
  const [newReq, setNewReq] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const entry = upgradeId ? getEntry(upgradeId) : null;
  const current = entry ? player.levels[entry.id] ?? entry.startLevel : 0;
  const next = entry?.kind === "one_time" ? 1 : current + 1;
  const keygen = player.levels.keygen ?? 0;

  const plan = useMemo(() => entry
    ? planPurchase({ entry, method, currentLevel: current, targetLevel: next, keygenLevel: keygen, kb: app.kb })
    : null, [entry, method, current, next, keygen, app.kb]);
  const line = plan?.lines[0] ?? null;
  const known = line?.cost.value ?? null;
  const xpKnown = plan?.totalExp ?? null;

  const price = parseWhole(priceText);
  const b = parseDraft(before);
  const preview = xpKnown !== null && b.state && !b.error ? addXp(b.state, xpKnown, reqFor) : null;

  function choose(id: string, m: Method = "store") {
    setUpgradeId(id);
    const e = id ? getEntry(id) : null;
    const meth: Method = e && !methodsFor(e).includes(m) ? "store" : m;
    setMethod(meth);
    setErr(null);
    if (e) {
      const cur = player.levels[e.id] ?? e.startLevel;
      const p = planPurchase({ entry: e, method: meth, currentLevel: cur, targetLevel: e.kind === "one_time" ? 1 : cur + 1, keygenLevel: keygen, kb: app.kb });
      setPriceText(p.lines[0]?.cost.value != null ? String(p.lines[0].cost.value) : "");
    }
  }

  function reset() {
    setPhase("form"); setDone(null); setErr(null); setUpgradeId(""); setPriceText("");
    setBefore(draftFrom(app.player!.character)); setPending(null); setNewReq("");
  }

  /** Saves the purchase and shares anything new it taught us. */
  async function finish(beforeState: CharacterState, afterState: CharacterState) {
    if (!plan || !entry || price === null) return;
    const ck = missingKey({ kind: plan.method === "download" ? "download_price" : entry.kind === "one_time" ? "one_time_price" : "store_price", fromLevel: plan.fromLevel, toLevel: plan.toLevel });
    const result = buildRecord({
      plan, entered: known === null || line?.costSource === "component_sum" ? { [ck]: price } : {},
      before: beforeState, after: afterState, keygenLevel: method === "download" ? keygen : null,
      kb: app.kb, reqFor, contributor: app.user.username, notes: "", now: new Date().toISOString(), newId
    });
    if (result.inference.status === "invalid") { setErr(result.inference.error ?? "Check the numbers"); return; }

    // The game charged something different from the database: record what this player saw.
    const extra: PriceObservation[] = [];
    if (known !== null && line?.costSource === "observed" && price !== known) {
      extra.push({
        id: newId(), upgradeId: entry.id, method, fromLevel: plan.fromLevel, toLevel: plan.toLevel, cost: price,
        costType: entry.kind === "one_time" ? "one_time" : method === "store" ? "per_level" : "combined",
        priceBasis: "final", keygenLevel: method === "download" ? keygen : null, contributor: app.user.username,
        createdAt: result.record.createdAt, status: "observed", notes: "", purchaseId: result.record.id
      });
      result.record.cost = price;
      result.record.costSource = "entered";
    }

    const nextState: PlayerState = {
      ...app.player!, character: afterState,
      levels: { ...app.player!.levels, [entry.id]: plan.toLevel }, updatedAt: result.record.createdAt
    };
    setBusy(true); setErr(null);
    try {
      await app.recordPurchase(result.record, nextState);
      // Don't re-share a level's XP needed this player already reported with the same value.
      const picked = result.candidates.filter((c) => c.checked && (c.type !== "level_req" ||
        !app.observations.levelReqs.some((r) => r.level === c.data.level && r.expRequired === c.data.expRequired && r.contributor === app.user.username)));
      const contribution = {
        prices: [...extra, ...picked.flatMap((c) => (c.type === "price" ? [c.data] : []))],
        exp: picked.flatMap((c) => (c.type === "exp" ? [c.data] : [])),
        levelReqs: picked.flatMap((c) => (c.type === "level_req" ? [c.data] : []))
      };
      const shared = [...extra.map((p) => `${entry.name} price ${fmt(p.cost)} (differs from database)`), ...picked.map((c) => c.label)];
      if (shared.length) {
        try { await app.contribute(contribution); }
        catch (e) { setErr(`Purchase saved, but sharing failed: ${e instanceof Error ? e.message : String(e)}`); }
      }
      setDone({ result, shared, leveledUp: afterState.level - beforeState.level });
      setPhase("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function onPurchase() {
    if (!plan || plan.errors.length) return;
    if (price === null) { setErr("Enter the price shown in the game"); return; }
    if (!b.state || b.error) { setErr(b.error ?? "Enter your LVL and XP"); return; }
    setErr(null);
    if (xpKnown === null) {
      // Nobody knows this upgrade's XP yet: learn it from the stats after buying.
      setAfter({ level: String(b.state.level), exp: "", required: String(b.state.required ?? "") });
      setPhase("after");
      return;
    }
    const g = addXp(b.state, xpKnown, reqFor);
    if (g.required === null) {
      setPending({ level: g.level, exp: g.exp });
      setNewReq("");
      setPhase("need_req");
      return;
    }
    await finish(b.state, { level: g.level, exp: g.exp, required: g.required });
  }

  // ---------- done ----------
  if (phase === "done" && done && entry) {
    const r = done.result.record;
    return (
      <div className="screen">
        <div className="success-hero">
          <div className="success-icon">✓</div>
          <h1>{entry.name} {entry.kind === "one_time" ? "purchased" : `upgraded to Lv ${r.toLevel}`}</h1>
          {done.leveledUp > 0 && <div className="levelup">Level up! You're now LVL {r.after.level}</div>}
        </div>
        <Card>
          <dl className="summary">
            <dt>Method</dt><dd>{methodLabel(r.method)}</dd>
            <dt>Cost</dt><dd className="mono">{fmt(r.cost)}</dd>
            <dt>XP</dt><dd className="mono">{r.expEarned !== null ? `+${fmt(r.expEarned)}` : "unknown"}</dd>
            <dt>Before</dt><dd className="mono">{stateText(r.before)}</dd>
            <dt>Now</dt><dd className="mono">{stateText(r.after)}</dd>
          </dl>
        </Card>
        {done.result.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
        {err && <Notice tone="bad">{err}</Notice>}
        {done.shared.length > 0 && (
          <Card title="Shared with your crew">
            <ul className="tight">{done.shared.map((s) => <li key={s}>{s}</li>)}</ul>
          </Card>
        )}
        <div className="btn-row">
          <button className="btn ghost grow" onClick={() => go("home")}>Home</button>
          <button className="btn primary grow" onClick={reset}>Buy another</button>
        </div>
      </div>
    );
  }

  // ---------- new level's XP requirement unknown ----------
  if (phase === "need_req" && pending && b.state) {
    const n = parseWhole(newReq);
    return (
      <div className="screen">
        <button className="link" onClick={() => setPhase("form")}>‹ Back</button>
        <div className="success-hero"><div className="levelup">Level up! LVL {pending.level}</div></div>
        <Card title={`What does LVL ${pending.level} need?`}>
          <p className="hint">Your game home screen now shows <b className="mono">{fmt(pending.exp)} / ?</b>. Enter the right-hand number. Nobody has recorded it yet.</p>
          <input className="input mono big-input" inputMode="numeric" pattern="[0-9]*" aria-label={`XP needed at level ${pending.level}`}
            value={newReq} onChange={(e) => setNewReq(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 650" autoFocus />
          {err && <Notice tone="bad">{err}</Notice>}
          <button className="btn primary full" disabled={busy || !n} onClick={async () => {
            if (!n) return;
            // More than one level-up is possible if the reward is large; keep going with the new number.
            const g = addXp({ level: pending.level, exp: pending.exp, required: n }, 0, reqFor);
            if (g.required === null) { setPending({ level: g.level, exp: g.exp }); setNewReq(""); return; }
            await finish(b.state!, { level: g.level, exp: g.exp, required: g.required });
          }}>{busy ? "Saving…" : "Finish purchase"}</button>
        </Card>
      </div>
    );
  }

  // ---------- XP unknown: read stats after buying ----------
  if (phase === "after" && b.state && entry) {
    const a = parseDraft(after);
    return (
      <div className="screen">
        <button className="link" onClick={() => setPhase("form")}>‹ Back</button>
        <h1>Your stats now</h1>
        <p className="lead">Nobody knows how much XP {entry.name} Lv {next} gives yet. Enter what your game home screen shows <b>after buying</b> and the app works it out.</p>
        <Card>
          <div className="hint">Before: <span className="mono">{stateText(b.state)}</span></div>
          {(() => {
            const pr = method === "store" ? app.kb.storeLevelExp(entry.id, next).predicted ?? null : null;
            return pr !== null ? <div className="hint">The likely formula expects <b className="mono">+{fmt(pr)} XP</b>. Enter what the game shows so we can check it.</div> : null;
          })()}
          <CharacterForm draft={after} onChange={setAfter} autoFocus />
          {a.state && !a.error && a.state.level >= b.state.level && (() => {
            // XP carries over: finish the old level, then count what spilled into the new one.
            const inf = inferExpGained(b.state, a.state, reqFor);
            if (inf.status === "exact") return <Notice tone="good"><b>+{fmt(inf.exp)} XP</b> from this purchase</Notice>;
            if (inf.status === "incomplete") return <Notice tone="info">At least <b>+{fmt(inf.atLeast)} XP</b>. The XP needed for LVL {inf.missingLevels.join(", ")} isn't known yet.</Notice>;
            return <Notice tone="bad">{inf.error}</Notice>;
          })()}
          {a.error && after.exp !== "" && <Notice tone="bad">{a.error}</Notice>}
          {err && <Notice tone="bad">{err}</Notice>}
          <button className="btn primary full" disabled={busy || !a.state || !!a.error} onClick={() => a.state && finish(b.state!, a.state)}>
            {busy ? "Saving…" : "Save purchase"}
          </button>
        </Card>
      </div>
    );
  }

  // ---------- form ----------
  const methods = entry ? methodsFor(entry) : [];
  const ready = !!plan && plan.errors.length === 0 && price !== null && !!b.state && !b.error;

  return (
    <div className="screen">
      <h1>Purchase</h1>

      <Card title="1 · What are you buying?">
        <select className="input" value={upgradeId} onChange={(e) => choose(e.target.value, method)} aria-label="Software">
          <option value="">Choose software…</option>
          {GROUPS.map((g) => (
            <optgroup key={g} label={CATEGORY_LABEL[g]}>
              {CATALOG.filter((e) => e.category === g).map((e) => {
                const lvl = player.levels[e.id] ?? e.startLevel;
                const maxed = (e.maxLevel !== null && lvl >= e.maxLevel) || (e.kind === "one_time" && lvl >= 1);
                return (
                  <option key={e.id} value={e.id} disabled={maxed}>
                    {e.name} — {e.kind === "one_time" ? (lvl >= 1 ? "owned" : "not owned") : maxed ? `Lv ${lvl} (max)` : `Lv ${lvl} → ${lvl + 1}`}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
        {entry && (
          <Segmented label="Where" value={method} onChange={(m) => choose(entry.id, m)} options={[
            { value: "store", label: "Store", disabled: !methods.includes("store") },
            { value: "download", label: "Keygen", disabled: !methods.includes("download") }
          ]} />
        )}
        {entry && !entry.download && <div className="hint">{entry.name} is only sold in the store.</div>}
        {entry && method === "download" && <div className="hint">Your Keygen is Lv {keygen}.</div>}
      </Card>

      {plan?.errors.map((e) => <Notice key={e} tone="bad">{e}</Notice>)}

      {entry && plan && plan.errors.length === 0 && (
        <Card title={`2 · Price for ${entry.kind === "one_time" ? entry.name : `Lv ${next}`}`}>
          <input className="input mono big-input" inputMode="numeric" pattern="[0-9]*" aria-label="Price"
            value={priceText} onChange={(e) => setPriceText(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="Price shown in game" />
          {known !== null && line ? (
            <div className="hint row-inline">
              <span>{line.costSource === "component_sum" ? "Estimated from database" : "From the database"}</span>
              {line.costSource !== "component_sum" && <RelBadge r={line.cost.reliability} count={line.cost.count} />}
              <span>· change it if the game shows something else</span>
            </div>
          ) : (
            <div className="hint">Not in the database yet. Enter the price the {method === "store" ? "store" : "Keygen"} shows.</div>
          )}
          {entry.defensiveDiscount && method === "store" && <div className="hint">Enter the discounted price the store shows.</div>}
        </Card>
      )}

      {entry && plan && plan.errors.length === 0 && (
        <Card title="3 · Your stats before buying">
          <p className="hint">From your game home screen. Update them if XP changed from missions or hacks.</p>
          <CharacterForm draft={before} onChange={setBefore} />
          {b.error && <Notice tone="bad">{b.error}</Notice>}
          {xpKnown !== null && preview && b.state && (
            <div className={`preview${preview.levelsGained ? " up" : ""}`}>
              <span>+{fmt(xpKnown)} XP</span>
              <span aria-hidden="true">→</span>
              <span className="mono">LVL {preview.level} · {fmt(preview.exp)} / {preview.required !== null ? fmt(preview.required) : "?"}</span>
              {preview.levelsGained > 0 && <span className="badge rel-confirmed">Level up!</span>}
              {line && !isVerified(line.exp.reliability) && <span className="hint">(XP seen once)</span>}
            </div>
          )}
          {xpKnown === null && <div className="hint">XP for this upgrade isn't known yet — you'll enter your stats after buying so it can be worked out.</div>}
        </Card>
      )}

      {err && <Notice tone="bad">{err}</Notice>}
      {entry && (
        <div className="sticky-actions">
          <button className="btn primary grow" disabled={!ready || busy} onClick={onPurchase}>
            {busy ? "Saving…" : `Purchase${price !== null ? ` for ${fmt(price)}` : ""}`}
          </button>
        </div>
      )}
      {!entry && <p className="hint">Buy it in the game first, then record it here. Your device updates automatically.</p>}
    </div>
  );
}
