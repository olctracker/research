import { useMemo, useState } from "react";
import { newId } from "../data/repository";
import { CATEGORY_LABEL } from "../domain/catalog";
import { RELIABILITY_LABEL } from "../domain/knowledge";
import { needsEntry, NextPriceRow, nextPriceRows } from "../domain/nextPrices";
import type { Category, Method, PriceObservation } from "../domain/types";
import { useApp } from "../state";
import { Card, fmt, Notice, parseWhole, RelBadge, Segmented } from "../ui/components";

const ORDER: Category[] = ["core", "defensive", "offensive", "virus", "utility", "one_time"];

function PriceRow({ row, onSave }: { row: NextPriceRow; onSave: (row: NextPriceRow, cost: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { entry, status, lookup } = row;
  const oneTime = entry.kind === "one_time";
  const needs = status === "missing" || status === "conflict";
  const showInput = needs || editing;

  async function save() {
    const v = parseWhole(text);
    if (v === null) { setErr("Enter the price as a whole number"); return; }
    setBusy(true); setErr(null);
    try { await onSave(row, v); setText(""); setEditing(false); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <li className={`price-row${needs ? " needs" : ""}`}>
      <div className="price-main">
        <div className="grow">
          <div className="row-title">{entry.name}</div>
          <div className="hint mono">
            {oneTime ? (status === "owned" ? "Purchased" : "Not purchased")
              : status === "maxed" ? `Lv ${row.currentLevel} · max level`
              : <>Lv {row.currentLevel} → <b>{row.nextLevel}</b></>}
          </div>
        </div>
        <div className="price-value">
          {status === "known" && lookup && (
            <>
              <span className="mono strong">{fmt(lookup.value)}</span>
              <RelBadge r={lookup.reliability} count={lookup.count} />
            </>
          )}
          {status === "missing" && <span className="badge need">Needs price</span>}
          {status === "conflict" && lookup && <span className="badge rel-conflict" title={RELIABILITY_LABEL.conflict}>Conflict: {lookup.values.map(fmt).join(" / ")}</span>}
          {status === "maxed" && <span className="badge rel-confirmed">Maxed</span>}
          {status === "owned" && <span className="badge rel-confirmed">Owned</span>}
          {status === "keygen_low" && <span className="badge rel-unknown">Keygen {row.nextLevel}+ needed</span>}
        </div>
      </div>
      {showInput && (
        <div className="price-entry">
          <input className="input mono" inputMode="numeric" pattern="[0-9]*" aria-label={`${entry.name} price for level ${row.nextLevel}`}
            placeholder={`Price for ${oneTime ? entry.name : `Lv ${row.nextLevel}`}`} value={text}
            onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))} />
          <button className="btn primary" disabled={busy || !text} onClick={save}>{busy ? "…" : "Save"}</button>
          {editing && <button className="btn ghost" onClick={() => { setEditing(false); setText(""); }}>Cancel</button>}
        </div>
      )}
      {status === "known" && !editing && (
        <button className="link small" onClick={() => setEditing(true)}>Game shows a different price?</button>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
    </li>
  );
}

export default function Prices({ method }: { method: Method }) {
  const { player, kb, contribute, user } = useApp();
  const [filter, setFilter] = useState<"all" | "needs">("all");
  const [msg, setMsg] = useState<string | null>(null);
  const levels = player?.levels ?? {};
  const rows = useMemo(() => nextPriceRows(levels, kb, method), [levels, kb, method]);
  const missing = needsEntry(rows);
  const keygen = levels.keygen ?? 0;
  const store = method === "store";

  async function onSave(row: NextPriceRow, cost: number) {
    const oneTime = row.entry.kind === "one_time";
    const obs: PriceObservation = {
      id: newId(), upgradeId: row.entry.id, method,
      fromLevel: oneTime ? 0 : row.currentLevel, toLevel: oneTime ? 1 : row.nextLevel, cost,
      costType: oneTime ? "one_time" : store ? "per_level" : "combined",
      priceBasis: "final", keygenLevel: store ? null : keygen,
      contributor: user.username, createdAt: new Date().toISOString(), status: "observed", notes: "", purchaseId: null
    };
    await contribute({ prices: [obs], exp: [], levelReqs: [] });
    setMsg(`Saved ${row.entry.name} ${oneTime ? "" : `level ${row.nextLevel} `}price: ${fmt(cost)}. Thanks!`);
  }

  const shown = rows.filter((r) => filter === "all" || r.status === "missing" || r.status === "conflict");
  const groups = ORDER.map((c) => ({ c, rows: shown.filter((r) => r.entry.category === c) })).filter((g) => g.rows.length);

  return (
    <div className="screen">
      <h1>{store ? "Store Prices" : "Keygen Prices"}</h1>
      <p className="lead">
        {store
          ? "The store only shows the price of your next level, so that's what each row asks for. Enter the price exactly as the store shows it."
          : `Keygen shows the price for your next level of each program. Your Keygen is level ${keygen}, so you can get keys up to level ${keygen}.`}
      </p>
      {store && <Notice tone="info">Defensive software already shows the 15% discount in the store — just enter the price you see.</Notice>}

      <div className={`summary-bar${missing ? " warn" : " good"}`}>
        <span className="summary-count mono">{missing}</span>
        <span className="grow">{missing ? `price${missing === 1 ? "" : "s"} you can see in game but nobody has entered yet` : "All your next-level prices are known. Nice!"}</span>
      </div>

      <Segmented label="Show" value={filter} onChange={setFilter} options={[
        { value: "all", label: "All" }, { value: "needs", label: missing ? `Needs price (${missing})` : "Needs price" }
      ]} />
      {msg && <Notice tone="good">{msg}</Notice>}

      {groups.length === 0 && <Card><div className="empty"><div className="empty-icon">✓</div><div>Nothing to enter right now.</div></div></Card>}
      {groups.map((g) => (
        <Card key={g.c} title={CATEGORY_LABEL[g.c]}>
          <ul className="price-list">{g.rows.map((r) => <PriceRow key={r.entry.id} row={r} onSave={onSave} />)}</ul>
        </Card>
      ))}
      <p className="hint">Prices you save are shared with your crew. If two people enter different prices, the admin decides which is right.</p>
    </div>
  );
}
