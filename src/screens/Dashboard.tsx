import { useMemo } from "react";
import { getEntry } from "../domain/catalog";
import { computeCompleteness, summarize } from "../domain/completeness";
import { methodLabel } from "../domain/knowledge";
import { needsEntry, nextPriceRows } from "../domain/nextPrices";
import { useApp } from "../state";
import { Card, fmt, Notice, Progress } from "../ui/components";
import { go } from "../ui/router";

export default function Dashboard() {
  const { player, purchases, kb, repo, conflicts, isAdmin, pendingCount } = useApp();
  const coverage = useMemo(() => summarize(computeCompleteness(kb)), [kb]);
  const levels = player?.levels ?? {};
  const storeMissing = useMemo(() => needsEntry(nextPriceRows(levels, kb, "store")), [levels, kb]);
  const keygenMissing = useMemo(() => needsEntry(nextPriceRows(levels, kb, "download")), [levels, kb]);
  if (!player) return null;
  const c = player.character;
  const pct = c.required ? Math.floor((c.exp / c.required) * 100) : 0;

  return (
    <div className="screen">
      {repo.mode === "local" && (
        <Notice tone="warn">Test mode: data is saved only in this browser. Connect Supabase to share with your crew (see README).</Notice>
      )}
      {isAdmin && pendingCount > 0 && (
        <button className="alert-card" onClick={() => go("settings")}>
          <span className="alert-count mono">{pendingCount}</span>
          <span className="grow"><b>New sign-up{pendingCount === 1 ? "" : "s"} waiting for approval</b><span className="hint block">Tap to approve or reject in Settings → Players.</span></span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      {isAdmin && conflicts.length > 0 && (
        <button className="alert-card" onClick={() => go("research")}>
          <span className="alert-count mono">{conflicts.length}</span>
          <span className="grow"><b>Conflicting reports need your decision</b><span className="hint block">Players entered different values. Tap to review.</span></span>
          <span aria-hidden="true">›</span>
        </button>
      )}

      <Card title={<>LVL <span className="mono big">{c.level}</span>{(player.reboots ?? 0) > 0 && <span className="badge rel-repeated reboot-badge">R{player.reboots}</span>}</>}
        action={<button className="btn sm ghost" onClick={() => go("device")}>Update</button>}>
        <div className="xp-line">
          <span className="muted">XP progress</span>
          <span className="mono">{fmt(c.exp)} / {fmt(c.required)}</span>
        </div>
        <Progress value={c.exp} max={c.required} />
        <div className="hint">{pct}% · {fmt((c.required ?? 0) - c.exp)} XP to LVL {c.level + 1}</div>
      </Card>

      <button className="btn primary full cta" onClick={() => go("buy")}>+ Record a purchase</button>

      <div className="tile-row">
        <button className={`tile${storeMissing ? " needs" : ""}`} onClick={() => go("store")}>
          <span className="tile-num mono">{storeMissing}</span>
          <span className="tile-label">Store prices needed</span>
        </button>
        <button className={`tile${keygenMissing ? " needs" : ""}`} onClick={() => go("keygen")}>
          <span className="tile-num mono">{keygenMissing}</span>
          <span className="tile-label">Keygen prices needed</span>
        </button>
      </div>

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
                  <div className="hint">{p.expEarned !== null ? `+${fmt(p.expEarned)} XP` : "XP ?"}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Crew research" action={<button className="btn sm ghost" onClick={() => go("research")}>Open</button>}>
        <div className="stat-row">
          <div><div className="stat mono">{coverage.percentKnown}%</div><div className="hint">of tracked prices &amp; XP known</div></div>
          <div><div className="stat mono">{coverage.counts.conflict}</div><div className="hint">conflicts</div></div>
          <div><div className="stat mono">{coverage.counts.observed_once}</div><div className="hint">seen only once</div></div>
        </div>
      </Card>
    </div>
  );
}
