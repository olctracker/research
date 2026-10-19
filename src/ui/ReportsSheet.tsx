import { useEffect, useMemo, useState } from "react";
import type { ObservationType } from "../data/repository";
import type { ExpObservation, LevelRequirementObservation, Method, PriceObservation } from "../domain/types";
import { useApp } from "../state";
import { fmt, Notice, parseWhole } from "./components";

/** One cell of the Data Table: which reports sit behind it. */
export interface ReportTarget {
  title: string;
  type: ObservationType;
  level: number;
  upgradeId?: string;
  method?: Method;
}

type Row =
  | { type: "price"; o: PriceObservation }
  | { type: "exp"; o: ExpObservation }
  | { type: "level_req"; o: LevelRequirementObservation };

const valueOf = (r: Row) => (r.type === "price" ? r.o.cost : r.type === "exp" ? r.o.exp : r.o.expRequired);
const toLevelOf = (r: Row) => (r.type === "level_req" ? r.o.level : r.o.toLevel);

export function ReportsSheet({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const { observations, repo, isAdmin, user, reloadObservations } = useApp();
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.classList.add("drawer-open");
    return () => { window.removeEventListener("keydown", esc); document.body.classList.remove("drawer-open"); };
  }, [onClose]);

  const rows: Row[] = useMemo(() => {
    const t = target;
    const list: Row[] =
      t.type === "level_req"
        ? observations.levelReqs.filter((o) => o.level === t.level).map((o) => ({ type: "level_req" as const, o }))
        : t.type === "price"
          ? observations.prices.filter((o) => o.upgradeId === t.upgradeId && o.method === t.method && o.toLevel === t.level).map((o) => ({ type: "price" as const, o }))
          : observations.exp.filter((o) => o.upgradeId === t.upgradeId && o.method === t.method && o.toLevel === t.level).map((o) => ({ type: "exp" as const, o }));
    // live reports first, newest first
    return list.sort((a, b) => Number(a.o.status === "rejected") - Number(b.o.status === "rejected") || b.o.createdAt.localeCompare(a.o.createdAt));
  }, [observations, target]);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true); setMsg(null);
    try { await fn(); await reloadObservations(); setMsg({ tone: "good", text: ok }); setEditing(null); }
    catch (e) { setMsg({ tone: "bad", text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  }

  const withdraw = (r: Row) => {
    if (!confirm(`Remove your report of ${fmt(valueOf(r))}?\n\nIt stays on record as rejected and stops counting.`)) return;
    run(() => repo.withdrawObservation(r.type, r.o.id), "Your report was removed.");
  };
  const flag = (r: Row) => {
    const reason = prompt("What looks wrong with this report?");
    if (!reason?.trim()) return;
    run(() => repo.flagObservation(r.type, r.o.id, reason.trim().slice(0, 500)), "Flagged for the admin to check.");
  };
  const setStatus = (r: Row, s: "rejected" | "observed") =>
    run(() => repo.setObservationStatus(r.type, r.o.id, s), s === "rejected" ? "Report rejected. It no longer counts." : "Report restored.");

  return (
    <>
      <div className="scrim sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={target.title}>
        <div className="sheet-head">
          <div className="grow"><div className="sheet-title">{target.title}</div><div className="hint">{rows.length} report{rows.length === 1 ? "" : "s"}</div></div>
          <button className="btn sm ghost" onClick={onClose} aria-label="Close">Close</button>
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        {rows.length === 0 ? <p className="muted">No reports yet.</p> : (
          <ul className="rows">
            {rows.map((r) => {
              const mine = r.o.contributor === user.username;
              const rejected = r.o.status === "rejected";
              return (
                <li key={r.o.id} className={`report${rejected ? " rejected" : ""}`}>
                  <div className="report-top">
                    <span className="mono report-value">{fmt(valueOf(r))}</span>
                    {r.type !== "level_req" && <span className="hint mono">Lv {r.o.fromLevel}→{r.o.toLevel}</span>}
                    <span className={`badge st-${r.o.status}`}>{r.o.status}</span>
                  </div>
                  <div className="hint">
                    <b>{r.o.contributor || "unknown"}</b>{mine ? " (you)" : ""} · {new Date(r.o.createdAt).toLocaleString()}
                    {r.o.reboots != null ? ` · R${r.o.reboots}` : ""}
                    {r.type !== "level_req" && r.o.purchaseId ? " · from a recorded purchase" : ""}
                  </div>
                  {r.o.notes && <div className="hint report-notes">{r.o.notes}</div>}

                  {editing === r.o.id ? (
                    <EditForm row={r} busy={busy} onCancel={() => setEditing(null)}
                      onSave={(lvl, val, move) => run(() => repo.editObservation(r.type, r.o.id, lvl, val, move),
                        lvl !== toLevelOf(r) ? `Moved to ${r.type === "level_req" ? "LVL" : "level"} ${lvl}.` : "Value corrected.")} />
                  ) : (
                    <div className="report-actions">
                      {isAdmin && <button className="btn sm" disabled={busy} onClick={() => { setEditing(r.o.id); setMsg(null); }}>Fix level / value</button>}
                      {isAdmin && !rejected && <button className="btn sm danger" disabled={busy} onClick={() => setStatus(r, "rejected")}>Reject</button>}
                      {isAdmin && rejected && <button className="btn sm ghost" disabled={busy} onClick={() => setStatus(r, "observed")}>Restore</button>}
                      {!isAdmin && mine && r.o.status === "observed" && <button className="btn sm danger" disabled={busy} onClick={() => withdraw(r)}>Remove my report</button>}
                      {!isAdmin && !mine && !rejected && <button className="btn sm ghost" disabled={busy} onClick={() => flag(r)}>Flag as wrong</button>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="hint">
          {isAdmin
            ? "Fixing keeps the old numbers in the report's notes. Rejected reports stay on record but stop counting."
            : "Made a mistake? Remove your own report here. Spotted someone else's? Flag it and the admin will check."}
        </p>
      </div>
    </>
  );
}

function EditForm({ row, busy, onSave, onCancel }: {
  row: Row; busy: boolean; onSave: (level: number, value: number, movePurchase: boolean) => void; onCancel: () => void;
}) {
  const [level, setLevel] = useState(String(toLevelOf(row)));
  const [value, setValue] = useState(String(valueOf(row)));
  const hasPurchase = row.type !== "level_req" && !!row.o.purchaseId;
  const [move, setMove] = useState(hasPurchase);
  const lvl = parseWhole(level);
  const val = parseWhole(value);
  const valueLabel = row.type === "price" ? "Price" : row.type === "exp" ? "XP" : "XP needed";
  const ok = lvl !== null && lvl >= 1 && val !== null && (row.type !== "level_req" || val > 0);
  const jump = row.type === "level_req" ? 0 : row.o.toLevel - row.o.fromLevel;

  return (
    <div className="edit-form">
      <div className="grid2">
        <label className="field">{row.type === "level_req" ? "Character LVL" : "Level (the level it took you to)"}
          <input className="input mono" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} />
        </label>
        <label className="field">{valueLabel}
          <input className="input mono" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
      </div>
      {row.type !== "level_req" && lvl !== null && lvl >= 1 && <p className="hint">Will be saved as Lv {lvl - jump}→{lvl}.</p>}
      {hasPurchase && (
        <label className="switch"><input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} />
          <span>Also move the {row.type === "price" ? "XP" : "price"} from the same purchase</span></label>
      )}
      <div className="report-actions">
        <button className="btn sm primary" disabled={!ok || busy} onClick={() => ok && onSave(lvl!, val!, move)}>Save fix</button>
        <button className="btn sm ghost" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
