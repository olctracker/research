import { useState } from "react";
import { getEntry } from "../domain/catalog";
import { methodLabel } from "../domain/knowledge";
import { useApp } from "../state";
import { Card, fmt, Notice } from "../ui/components";

export const CONF: Record<string, string> = {
  exact: "Exact",
  uses_unverified: "Uses unverified data",
  incomplete: "Incomplete",
  estimate: "Estimate"
};

export default function History() {
  const { purchases, deletePurchase } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const total = purchases.reduce((s, p) => s + (p.cost ?? 0), 0);
  const totalExp = purchases.reduce((s, p) => s + (p.expEarned ?? 0), 0);

  async function remove(id: string) {
    if (!confirm("Delete this purchase from your history? Your current levels won't change.")) return;
    try { await deletePurchase(id); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="screen">
      <h1>Purchase history</h1>
      <div className="stat-row">
        <div><div className="stat mono">{purchases.length}</div><div className="hint">purchases</div></div>
        <div><div className="stat mono">{fmt(total)}</div><div className="hint">known spend</div></div>
        <div><div className="stat mono">{fmt(totalExp)}</div><div className="hint">exact XP</div></div>
      </div>
      {err && <Notice tone="bad">{err}</Notice>}
      {purchases.length === 0 && <p className="muted">Nothing recorded yet.</p>}
      {purchases.map((p) => {
        const e = getEntry(p.upgradeId);
        const isOpen = open === p.id;
        return (
          <Card key={p.id}>
            <button className="history-head" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
              <div className="grow">
                <div className="row-title">{e.name} {e.kind === "one_time" ? "" : <span className="mono">{p.fromLevel} → {p.toLevel}</span>}</div>
                <div className="hint">{methodLabel(p.method)} · {new Date(p.createdAt).toLocaleString()}</div>
              </div>
              <div className="right">
                <div className="mono">{fmt(p.cost)}</div>
                <div className="hint">{p.expEarned !== null ? `+${fmt(p.expEarned)} XP` : "XP ?"}</div>
              </div>
            </button>
            {p.confidence !== "exact" && <span className={`badge ${p.confidence === "incomplete" ? "rel-conflict" : "rel-once"}`}>{CONF[p.confidence]}</span>}
            {isOpen && (
              <div className="history-body">
                <dl className="summary">
                  <dt>Before</dt><dd className="mono">Lv {p.before.level} · {fmt(p.before.exp)}/{fmt(p.before.required)}</dd>
                  <dt>After</dt><dd className="mono">Lv {p.after.level} · {fmt(p.after.exp)}/{fmt(p.after.required)}</dd>
                  <dt>Expected XP</dt><dd className="mono">{fmt(p.expExpected)}</dd>
                  <dt>Cost source</dt><dd>{p.costSource}</dd>
                  {p.keygenLevel !== null && <><dt>Keygen</dt><dd className="mono">{p.keygenLevel}</dd></>}
                  {p.notes && <><dt>Notes</dt><dd>{p.notes}</dd></>}
                </dl>
                <details>
                  <summary>Data sources</summary>
                  <ul className="tight">{p.dataSources.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </details>
                <button className="btn sm danger" onClick={() => remove(p.id)}>Delete</button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
