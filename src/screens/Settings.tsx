import { FormEvent, useEffect, useState } from "react";
import type { PlayerSummary } from "../data/repository";
import { flattenPurchases, toCsv, toJson } from "../domain/export";
import { useApp } from "../state";
import { Card, download, Notice } from "../ui/components";
import { InstallCard } from "../ui/InstallCard";
import { go } from "../ui/router";

const stamp = () => new Date().toISOString().slice(0, 10);
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

function ChangePin() {
  const { repo } = useApp();
  const [oldPin, setOld] = useState("");
  const [newPin, setNew] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (newPin.length !== 4) { setMsg({ tone: "bad", text: "New PIN must be 4 digits" }); return; }
    setBusy(true); setMsg(null);
    try {
      await repo.changePin(oldPin, newPin);
      setOld(""); setNew("");
      setMsg({ tone: "good", text: "PIN changed." });
    } catch (err) { setMsg({ tone: "bad", text: err instanceof Error ? err.message : String(err) }); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="stack-form">
      <div className="grid2">
        <div className="field"><label htmlFor="op">Current PIN</label>
          <input id="op" className="input pin mono" type="password" inputMode="numeric" autoComplete="current-password" value={oldPin} onChange={(e) => setOld(digits(e.target.value))} /></div>
        <div className="field"><label htmlFor="np">New PIN</label>
          <input id="np" className="input pin mono" type="password" inputMode="numeric" autoComplete="new-password" value={newPin} onChange={(e) => setNew(digits(e.target.value))} /></div>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <button className="btn full" type="submit" disabled={busy || oldPin.length !== 4}>{busy ? "Saving…" : "Change PIN"}</button>
    </form>
  );
}

function Players() {
  const { repo, user } = useApp();
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  useEffect(() => { repo.listPlayers().then(setPlayers).catch((e) => setMsg({ tone: "bad", text: String(e.message ?? e) })); }, [repo]);

  async function reset(p: PlayerSummary) {
    const pin = prompt(`New 4-digit PIN for ${p.username}:`);
    if (pin === null) return;
    if (!/^\d{4}$/.test(pin)) { setMsg({ tone: "bad", text: "PIN must be exactly 4 digits" }); return; }
    try {
      await repo.resetPin(p.userId, pin);
      setMsg({ tone: "good", text: `PIN for ${p.username} reset. Tell them their new PIN privately.` });
    } catch (e) { setMsg({ tone: "bad", text: e instanceof Error ? e.message : String(e) }); }
  }

  return (
    <Card title={`Players${players ? ` (${players.length})` : ""}`}>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!players ? <p className="muted">Loading…</p> : (
        <ul className="rows">
          {players.map((p) => (
            <li key={p.userId} className="row">
              <div className="grow">
                <div className="row-title">{p.username}{p.userId === user.userId && <span className="badge rel-confirmed" style={{ marginLeft: 8 }}>You · admin</span>}</div>
                <div className="hint">Joined {new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
              {p.userId !== user.userId && <button className="btn sm ghost" onClick={() => reset(p)}>Reset PIN</button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Settings() {
  const { repo, user, isAdmin, player, purchases, observations, signOut } = useApp();

  const exportJson = () => download(`hedb-export-${stamp()}.json`, toJson({
    exportedAt: new Date().toISOString(), app: "hackex2-upgrade-tracker", formatVersion: 1,
    player, purchases, observations
  }), "application/json");
  const csv = (name: string, text: string) => download(`hedb-${name}-${stamp()}.csv`, text, "text/csv");

  return (
    <div className="screen">
      <h1>More</h1>

      <Card title="Account">
        <dl className="summary">
          <dt>Username</dt><dd>{user.username}</dd>
          <dt>Role</dt><dd>{isAdmin ? "Admin" : "Player"}</dd>
          <dt>Storage</dt><dd>{repo.mode === "supabase" ? "Shared database" : "This browser only (test mode)"}</dd>
        </dl>
        <button className="btn ghost full" onClick={() => go("setup")}>Edit game state</button>
      </Card>

      <Card title="Change PIN"><ChangePin /></Card>

      {isAdmin && <Players />}

      <InstallCard />

      <Card title="Export">
        <p className="hint">Download data for backups or to analyse in a spreadsheet.</p>
        <div className="btn-col">
          <button className="btn" onClick={exportJson}>Everything (JSON)</button>
          <button className="btn" onClick={() => csv("prices", toCsv(observations.prices))} disabled={!observations.prices.length}>Price observations (CSV)</button>
          <button className="btn" onClick={() => csv("exp", toCsv(observations.exp))} disabled={!observations.exp.length}>EXP observations (CSV)</button>
          <button className="btn" onClick={() => csv("level-requirements", toCsv(observations.levelReqs))} disabled={!observations.levelReqs.length}>Character level requirements (CSV)</button>
          <button className="btn" onClick={() => csv("purchases", toCsv(flattenPurchases(purchases)))} disabled={!purchases.length}>My purchase history (CSV)</button>
        </div>
      </Card>

      <Card title="Coming later">
        <ul className="tight muted">
          <li>Formula discovery (fit and test cost/EXP formulas)</li>
          <li>Cheapest path to a target level</li>
          <li>Reboot planning — off until reboot rules are verified</li>
        </ul>
      </Card>

      <button className="btn danger full" onClick={signOut}>Sign out</button>
    </div>
  );
}
