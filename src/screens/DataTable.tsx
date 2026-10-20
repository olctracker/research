import { useMemo, useState } from "react";
import { CATALOG, CATEGORY_LABEL, getEntry } from "../domain/catalog";
import { Lookup, Reliability, RELIABILITY_LABEL } from "../domain/knowledge";
import type { Category } from "../domain/types";
import { useApp } from "../state";
import { Card, fmt } from "../ui/components";
import { ReportsSheet, ReportTarget } from "../ui/ReportsSheet";

const GROUPS: Category[] = ["core", "defensive", "offensive", "virus", "utility", "one_time"];
const CLS: Record<Reliability, string> = {
  unknown: "c-unknown", observed_once: "c-once", repeated: "c-repeated", confirmed: "c-confirmed", conflict: "c-conflict"
};

function Cell({ l, onOpen, empty = "n/a" }: { l: Lookup | null; onOpen: () => void; empty?: string }) {
  if (!l) return <td className="c-na" title={empty === "n/a" ? "Not applicable" : undefined}>{empty}</td>;
  const p = l.predicted ?? null;
  const formulaWord = l.predictedStatus === "verified" ? "Formula" : "Likely formula";
  let [cls, title, text] =
    l.reliability === "unknown" ? ["c-unknown", "Missing", "—"]
    : l.reliability === "conflict" ? ["c-conflict", `Conflict: ${l.values.join(" / ")}`, l.values.map(fmt).join("/")]
    : [CLS[l.reliability], `${RELIABILITY_LABEL[l.reliability]} (${l.count})`, fmt(l.value)];
  if (l.reliability === "unknown" && p !== null) {
    [cls, title, text] = [l.predictedStatus === "verified" ? "c-formula" : "c-likely", `${formulaWord} (nobody has reported it yet)`, `${l.predictedStatus === "verified" ? "" : "≈"}${fmt(p)}`];
  }
  const off = p !== null && l.reliability !== "unknown" && !l.values.every((v) => v === p);
  return (
    <td className={`${cls} tap${off ? " c-off" : ""}`} title={off ? `${title} · ${formulaWord} says ${fmt(p)}` : title}>
      <button className="cell-btn" onClick={onOpen}>{text}{off && <span className="off-mark" aria-label={`${formulaWord} says ${fmt(p)}`}> ≠</span>}</button>
    </td>
  );
}

const COLS: { type: "price" | "exp"; method: "store" | "download"; label: string }[] = [
  { type: "price", method: "store", label: "store price" }, { type: "exp", method: "store", label: "store XP" },
  { type: "price", method: "download", label: "Keygen price" }, { type: "exp", method: "download", label: "Keygen XP" }
];

export default function DataTable() {
  const { kb, player, isAdmin } = useApp();
  const [subject, setSubject] = useState("firewall");
  const [extra, setExtra] = useState(0);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [open, setOpen] = useState<ReportTarget | null>(null);
  const isChar = subject === "character";
  const entry = isChar ? null : getEntry(subject);

  const rows = useMemo(() => {
    if (isChar) {
      const hi = Math.max(30, kb.highestObservedCharacterLevel() + 3, (player?.character.level ?? 1) + 3) + extra;
      return Array.from({ length: hi + 1 }, (_, i) => ({ level: i + 1, cells: [i === 0 ? null : kb.levelRequirement(i)] }));
    }
    const e = entry!;
    if (e.kind === "one_time") return [{ level: 1, cells: [kb.oneTimeItemPrice(e.id), kb.oneTimeItemExp(e.id), null, null] }];
    const mine = player?.levels[e.id] ?? e.startLevel;
    const to = e.maxLevel ?? Math.max(20, kb.highestObservedLevel(e.id) + 3, mine + 3) + extra;
    const out = [];
    for (let l = 1; l <= to; l++) {
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
          <option value="character">Character levels (XP to reach)</option>
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
                <tr><th>LVL</th><th>XP to reach</th></tr>
              ) : (
                <>
                  <tr><th rowSpan={2}>Lv</th><th colSpan={2}>Store</th><th colSpan={2}>Keygen</th></tr>
                  <tr><th>Price</th><th>XP</th><th>Price</th><th>XP</th></tr>
                </>
              )}
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.level} className={myLevel !== undefined && r.level === myLevel + 1 ? "mine" : ""}>
                  <th className="mono">{entry?.kind === "one_time" ? "—" : r.level}</th>
                  {r.cells.map((c, i) => (
                    <Cell key={i} l={c} empty={isChar ? "start" : "n/a"} onOpen={() => setOpen(isChar
                      ? { title: `XP to reach LVL ${r.level} (shown at LVL ${r.level - 1})`, type: "level_req", level: r.level - 1 }
                      : { title: `${entry!.name}${entry!.kind === "one_time" ? "" : ` Lv ${r.level}`} · ${COLS[i].label}`, type: COLS[i].type, method: COLS[i].method, upgradeId: entry!.id, level: r.level })} />
                  ))}
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
          <span className="c-formula">1,234 Formula</span>
          <span className="c-likely">≈1,234 Likely formula</span>
          <span><b className="bad-text">≠</b> Disagrees with formula</span>
        </div>
        <p className="hint">Tap any value to see who reported it{isAdmin ? ", and to move a report to the right level, correct it or reject it" : " and to remove your own mistakes"}.</p>
        {myLevel !== undefined && <p className="hint">The highlighted row is your next level{isChar ? `: the XP you need to reach LVL ${myLevel + 1}` : ""}.</p>}
        {entry && !entry.download && entry.kind !== "one_time" && <p className="hint">{entry.name} can't be bought with Keygen, so those columns are n/a.</p>}
      </Card>
      {open && <ReportsSheet target={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
