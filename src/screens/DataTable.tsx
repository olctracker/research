import { useMemo, useState } from "react";
import { CATALOG, CATEGORY_LABEL, getEntry } from "../domain/catalog";
import { Lookup, Reliability, RELIABILITY_LABEL } from "../domain/knowledge";
import type { Category } from "../domain/types";
import { useApp } from "../state";
import { Card, fmt } from "../ui/components";

const GROUPS: Category[] = ["core", "defensive", "offensive", "virus", "utility", "one_time"];
const CLS: Record<Reliability, string> = {
  unknown: "c-unknown", observed_once: "c-once", repeated: "c-repeated", confirmed: "c-confirmed", conflict: "c-conflict"
};

function Cell({ l }: { l: Lookup | null }) {
  if (!l) return <td className="c-na" title="Not applicable">n/a</td>;
  if (l.reliability === "unknown") return <td className="c-unknown" title="Missing">—</td>;
  if (l.reliability === "conflict") return <td className="c-conflict" title={`Conflict: ${l.values.join(" / ")}`}>{l.values.map(fmt).join("/")}</td>;
  return <td className={CLS[l.reliability]} title={`${RELIABILITY_LABEL[l.reliability]} (${l.count})`}>{fmt(l.value)}</td>;
}

export default function DataTable() {
  const { kb, player } = useApp();
  const [subject, setSubject] = useState("firewall");
  const [extra, setExtra] = useState(0);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const isChar = subject === "character";
  const entry = isChar ? null : getEntry(subject);

  const rows = useMemo(() => {
    if (isChar) {
      const hi = Math.max(30, kb.highestObservedCharacterLevel() + 3, (player?.character.level ?? 1) + 3) + extra;
      return Array.from({ length: hi }, (_, i) => ({ level: i + 1, cells: [kb.levelRequirement(i + 1)] }));
    }
    const e = entry!;
    if (e.kind === "one_time") return [{ level: 1, cells: [kb.oneTimeItemPrice(e.id), kb.oneTimeItemExp(e.id), null, null] }];
    const mine = player?.levels[e.id] ?? e.startLevel;
    const to = e.maxLevel ?? Math.max(20, kb.highestObservedLevel(e.id) + 3, mine + 3) + extra;
    const out = [];
    for (let l = e.startLevel + 1; l <= to; l++) {
      out.push({
        level: l,
        cells: [
          kb.storeLevelPrice(e.id, l), kb.storeLevelExp(e.id, l),
          e.download ? kb.downloadCombinedPrice(e.id, l - 1, l) : null,
          e.download ? kb.downloadExp(e.id, l) : null
        ]
      });
    }
    return out;
  }, [isChar, entry, kb, player, extra]);

  const applicable = rows.flatMap((r) => r.cells).filter((c): c is Lookup => c !== null);
  const missing = applicable.filter((c) => c.reliability === "unknown").length;
  const conflicts = applicable.filter((c) => c.reliability === "conflict").length;
  const shown = onlyMissing ? rows.filter((r) => r.cells.some((c) => c && (c.reliability === "unknown" || c.reliability === "conflict"))) : rows;
  const myLevel = isChar ? player?.character.level : entry ? player?.levels[entry.id] : undefined;
  const capped = isChar ? false : entry?.maxLevel !== null;

  return (
    <div className="screen">
      <h1>Data Table</h1>
      <p className="lead">Everything the crew has recorded, level by level. Blanks (—) are what's still missing.</p>

      <Card>
        <select className="input" aria-label="Show data for" value={subject} onChange={(e) => { setSubject(e.target.value); setExtra(0); }}>
          <option value="character">Character levels (XP needed)</option>
          {GROUPS.map((g) => (
            <optgroup key={g} label={CATEGORY_LABEL[g]}>
              {CATALOG.filter((e) => e.category === g).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
          ))}
        </select>
        <div className="stat-row">
          <div><div className="stat mono">{applicable.length - missing - conflicts}</div><div className="hint">known</div></div>
          <div><div className="stat mono warn-text">{missing}</div><div className="hint">missing</div></div>
          <div><div className="stat mono bad-text">{conflicts}</div><div className="hint">conflicts</div></div>
        </div>
        <label className="switch"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /><span>Only rows with gaps</span></label>
      </Card>

      <Card>
        <div className="table-wrap">
          <table className="table data-table">
            <thead>
              {isChar ? (
                <tr><th>LVL</th><th>XP needed</th></tr>
              ) : (
                <>
                  <tr><th rowSpan={2}>Lv</th><th colSpan={2}>Store</th><th colSpan={2}>Keygen</th></tr>
                  <tr><th>Price</th><th>XP</th><th>Price</th><th>XP</th></tr>
                </>
              )}
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.level} className={myLevel !== undefined && (isChar ? r.level === myLevel : r.level === myLevel + 1) ? "mine" : ""}>
                  <th className="mono">{entry?.kind === "one_time" ? "—" : r.level}</th>
                  {r.cells.map((c, i) => <Cell key={i} l={c} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!capped && entry?.kind !== "one_time" && (
          <button className="btn ghost full" onClick={() => setExtra((n) => n + 10)}>Show 10 more levels</button>
        )}
        <div className="legend-row">
          <span><i className="seg-confirmed" /> Confirmed</span>
          <span><i className="seg-repeated" /> Seen 2+ times</span>
          <span><i className="seg-once" /> Seen once</span>
          <span><i className="seg-conflict" /> Conflict</span>
          <span>— Missing</span>
        </div>
        {myLevel !== undefined && <p className="hint">The highlighted row is {isChar ? "your current level" : "your next level"}.</p>}
        {entry && !entry.download && entry.kind !== "one_time" && <p className="hint">{entry.name} can't be bought with Keygen, so those columns are n/a.</p>}
      </Card>
    </div>
  );
}
