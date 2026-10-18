import { useState } from "react";
import { ConflictGroup, resolution } from "../domain/conflicts";
import type { ExpObservation, LevelRequirementObservation, PriceObservation } from "../domain/types";
import { useApp } from "../state";
import { Card, fmt, Notice } from "../ui/components";

type Row = PriceObservation | ExpObservation | LevelRequirementObservation;
const fromPurchase = (r: Row) => "purchaseId" in r && !!r.purchaseId;
const how = (r: Row) => ("source" in r && r.source !== "entered" ? (r.source === "inferred" ? "worked out from XP" : "derived") : null);

export default function Conflicts() {
  const { conflicts, isAdmin, repo, reloadObservations } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  async function choose(g: ConflictGroup, value: number) {
    const others = g.options.filter((o) => o.value !== value).map((o) => fmt(o.value)).join(", ");
    if (!confirm(`Use ${fmt(value)} for ${g.title} · ${g.subtitle}?\n\nReports of ${others} will be marked rejected (they stay on record).`)) return;
    setBusy(g.key); setMsg(null);
    try {
      const { keep, reject } = resolution(g, value);
      await repo.resolveConflict(g.type, keep, reject);
      await reloadObservations();
      setMsg({ tone: "good", text: `${g.title} · ${g.subtitle}: set to ${fmt(value)}.` });
    } catch (e) {
      setMsg({ tone: "bad", text: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(null); }
  }

  return (
    <>
      <p className="lead">
        {isAdmin
          ? "Players reported different values for these. Check the game, then choose the right one. Nothing is deleted: other reports are kept and marked rejected."
          : "Players reported different values for these. The admin will choose the correct one."}
      </p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {conflicts.length === 0 && (
        <Card><div className="empty"><div className="empty-icon">✓</div><div>No conflicts right now.</div></div></Card>
      )}
      {conflicts.map((g) => {
        const total = g.options.reduce((s, o) => s + o.rows.length, 0);
        return (
          <Card key={g.key} title={<>{g.title} <span className="muted">· {g.subtitle}</span></>}>
            {g.challengesConfirmed && <Notice tone="warn">A newer report disagrees with the confirmed value.</Notice>}
            <ul className="options">
              {g.options.map((o) => (
                <li key={o.value} className={`option${o.confirmed ? " confirmed" : ""}`}>
                  <div className="option-head">
                    <span className="option-value mono">{fmt(o.value)}</span>
                    <span className="option-count">{o.rows.length} of {total} report{total === 1 ? "" : "s"}</span>
                    {o.confirmed && <span className="badge rel-confirmed">Confirmed</span>}
                  </div>
                  <ul className="reporters">
                    {o.rows.map((r) => (
                      <li key={r.id}>
                        <span className="who">{r.contributor}</span>
                        <span className="muted"> · {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                        {fromPurchase(r) && <span className="chip">from a recorded purchase</span>}
                        {how(r) && <span className="chip">{how(r)}</span>}
                        {"keygenLevel" in r && r.keygenLevel !== null && <span className="chip">Keygen {r.keygenLevel}</span>}
                        {r.reboots != null && <span className="chip">R{r.reboots}</span>}
                        {r.notes && <div className="hint">“{r.notes}”</div>}
                      </li>
                    ))}
                  </ul>
                  {isAdmin && (!o.confirmed || g.challengesConfirmed) && (
                    <button className="btn sm primary" disabled={busy === g.key} onClick={() => choose(g, o.value)}>
                      {busy === g.key ? "Saving…" : `${o.confirmed ? "Keep" : "Use"} ${fmt(o.value)}`}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </>
  );
}
