import { useMemo, useState } from "react";
import { CATALOG, CATEGORY_LABEL, getEntry } from "../domain/catalog";
import { computeCompleteness, summarize } from "../domain/completeness";
import { isVerified, methodLabel } from "../domain/knowledge";
import type { Category } from "../domain/types";
import { useApp } from "../state";
import { CharacterForm, draftFrom, parseDraft } from "../ui/CharacterForm";
import { Card, fmt, Notice, Progress } from "../ui/components";
import { go } from "../ui/router";

const GROUPS: Category[] = ["core", "defensive", "offensive", "virus", "utility"];

export default function Dashboard() {
  const { player, purchases, kb, savePlayer, repo, conflicts, isAdmin } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(draftFrom(player?.character));
  const [err, setErr] = useState<string | null>(null);

  const coverage = useMemo(() => summarize(computeCompleteness(kb)), [kb]);
  if (!player) return null;
  const c = player.character;

  // For each level-based upgrade: is the NEXT store level's price/EXP known?
  const nextInfo = (id: string) => {
    const e = getEntry(id);
    const lvl = player.levels[id] ?? e.startLevel;
    if (e.kind === "one_time") {
      return lvl >= 1 ? null : { level: 1, price: kb.oneTimeItemPrice(id), exp: kb.oneTimeItemExp(id) };
    }
    if (e.maxLevel !== null && lvl >= e.maxLevel) return null;
    return { level: lvl + 1, price: kb.storeLevelPrice(id, lvl + 1), exp: kb.storeLevelExp(id, lvl + 1) };
  };

  async function saveChar() {
    const { state, error } = parseDraft(draft);
    if (!state || error) { setErr(error); return; }
    try {
      await savePlayer({ ...player!, character: state, updatedAt: new Date().toISOString() });
      setEditing(false); setErr(null);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="screen">
      {repo.mode === "local" && (
        <Notice tone="warn">Test mode: data is saved only in this browser. Connect Supabase to share with your crew (see README).</Notice>
      )}
      {isAdmin && conflicts.length > 0 && (
        <button className="alert-card" onClick={() => go("research")}>
          <span className="alert-count mono">{conflicts.length}</span>
          <span className="grow"><b>Conflicting reports need your decision</b><span className="hint block">Players entered different values. Tap to review.</span></span>
          <span aria-hidden="true">›</span>
        </button>
      )}

      <Card
        title={<>Level <span className="mono big">{c.level}</span></>}
        action={<button className="btn sm ghost" onClick={() => { setDraft(draftFrom(c)); setEditing(!editing); }}>{editing ? "Close" : "Update"}</button>}
      >
        {editing ? (
          <>
            <p className="hint">Use this when EXP changed from something other than an upgrade (hacks, missions). It won't count as purchase EXP.</p>
            <CharacterForm draft={draft} onChange={setDraft} autoFocus />
            {err && <Notice tone="bad">{err}</Notice>}
            <button className="btn primary full" onClick={saveChar}>Save character</button>
          </>
        ) : (
          <>
            <div className="exp-line">
              <span className="mono">{fmt(c.exp)}</span>
              <span className="muted"> / {c.required !== null ? fmt(c.required) : "?"} EXP</span>
              {c.required !== null && <span className="muted"> · {fmt(c.required - c.exp)} to level {c.level + 1}</span>}
            </div>
            <Progress value={c.exp} max={c.required} />
            {c.required === null && <div className="hint">Add “EXP for next” to see progress.</div>}
          </>
        )}
      </Card>

      <button className="btn primary full cta" onClick={() => go("buy")}>+ Record a purchase</button>

      <Card title="Shared research" action={<button className="btn sm ghost" onClick={() => go("research")}>Open</button>}>
        <div className="stat-row">
          <div><div className="stat mono">{coverage.percentKnown}%</div><div className="hint">of tracked data points have a value</div></div>
          <div><div className="stat mono">{coverage.counts.conflict}</div><div className="hint">conflicts</div></div>
          <div><div className="stat mono">{coverage.counts.observed_once}</div><div className="hint">seen only once</div></div>
        </div>
        <div className="hint">Measured to level 20 for software with no known cap, so 100% here would not mean everything is known.</div>
      </Card>

      <Card title="Your software" action={<button className="btn sm ghost" onClick={() => go("setup")}>Edit</button>}>
        {GROUPS.map((g) => (
          <div key={g} className="sw-group">
            <div className="sw-group-title">{CATEGORY_LABEL[g]}</div>
            <ul className="sw-list">
              {CATALOG.filter((e) => e.category === g).map((e) => {
                const lvl = player.levels[e.id] ?? e.startLevel;
                const n = nextInfo(e.id);
                const known = n ? [n.price.value !== null, n.exp.value !== null] : null;
                const unverified = n && ((n.price.value !== null && !isVerified(n.price.reliability)) || (n.exp.value !== null && !isVerified(n.exp.reliability)));
                return (
                  <li key={e.id} className="sw">
                    <span className="sw-name">{e.name}</span>
                    <span className="sw-level mono">{lvl}{e.maxLevel !== null ? <span className="muted">/{e.maxLevel}</span> : null}</span>
                    <span className="sw-next">
                      {!n ? <span className="badge rel-confirmed">Maxed</span> : (
                        <>
                          <span className={`dot ${known![0] ? "on" : ""}`} title={`Level ${n.level} price ${known![0] ? "known" : "unknown"}`} />
                          <span className={`dot ${known![1] ? "on" : ""}`} title={`Level ${n.level} EXP ${known![1] ? "known" : "unknown"}`} />
                          {unverified && <span className="unv" title="Uses unverified data">!</span>}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="hint legend">Dots: next store level's <span className="dot on" /> price and <span className="dot on" /> EXP are known · <span className="unv">!</span> only seen once</div>
      </Card>

      <Card title="One-time purchases">
        <ul className="rows">
          {CATALOG.filter((e) => e.kind === "one_time").map((e) => (
            <li key={e.id} className="row">
              <span className="grow">{e.name}</span>
              <span className={`badge ${(player.levels[e.id] ?? 0) >= 1 ? "rel-confirmed" : "rel-unknown"}`}>
                {(player.levels[e.id] ?? 0) >= 1 ? "Purchased" : "Not purchased"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Recent purchases" action={<button className="btn sm ghost" onClick={() => go("history")}>All</button>}>
        {purchases.length === 0 ? <p className="muted">Nothing recorded yet.</p> : (
          <ul className="rows">
            {purchases.slice(0, 5).map((p) => (
              <li key={p.id} className="row">
                <div className="grow">
                  <div className="row-title">{getEntry(p.upgradeId).name} {getEntry(p.upgradeId).kind === "one_time" ? "" : `${p.fromLevel} → ${p.toLevel}`}</div>
                  <div className="hint">{methodLabel(p.method)} · {new Date(p.createdAt).toLocaleString()}</div>
                </div>
                <div className="right">
                  <div className="mono">{fmt(p.cost)}</div>
                  <div className="hint">{p.expEarned !== null ? `+${fmt(p.expEarned)} EXP` : "EXP ?"}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
