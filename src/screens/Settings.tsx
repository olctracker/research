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
  const { repo, user, refreshPlayers, setUsername } = useApp();
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => refreshPlayers().then(setPlayers).catch((e) => setMsg({ tone: "bad", text: String(e?.message ?? e) }));
  useEffect(() => { load(); }, [repo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(id: string, fn: () => Promise<void>, ok: string) {
    setBusy(id); setMsg(null);
    try { await fn(); setMsg({ tone: "good", text: ok }); await load(); }
    catch (e) { setMsg({ tone: "bad", text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  }

  const approve = (p: PlayerSummary) => act(p.userId, () => repo.setApproved(p.userId, true), `${p.username} approved. They can sign in and start now.`);
  const reject = (p: PlayerSummary) => {
    if (!confirm(`Reject and delete the account "${p.username}"?`)) return;
    act(p.userId, () => repo.deletePlayer(p.userId), `${p.username}'s sign-up was rejected and removed.`);
  };
  const remove = (p: PlayerSummary) => {
    if (!confirm(`Delete ${p.username}'s account?\n\nTheir device, purchases and sign-in are removed for good. Prices and XP they shared stay on record under "${p.username}".`)) return;
    act(p.userId, () => repo.deletePlayer(p.userId), `${p.username}'s account was deleted.`);
  };
  const rename = (p: PlayerSummary) => {
    const name = prompt(`New username for ${p.username} (3–20 letters, numbers or _).\nTheir PIN stays the same; they sign in with the new name.`, p.username);
    if (name === null) return;
    const u = name.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) { setMsg({ tone: "bad", text: "Username must be 3–20 letters, numbers or _" }); return; }
    if (u === p.username) return;
    act(p.userId, async () => { await repo.renamePlayer(p.userId, u); if (p.userId === user.userId) setUsername(u); },
      p.userId === user.userId ? `You're now ${u}. Sign in with the new name next time — same PIN.` : `${p.username} is now ${u}. Tell them to sign in with the new name — same PIN.`);
  };
  const reset = (p: PlayerSummary) => {
    const pin = prompt(`New 4-digit PIN for ${p.username}:`);
    if (pin === null) return;
    if (!/^\d{4}$/.test(pin)) { setMsg({ tone: "bad", text: "PIN must be exactly 4 digits" }); return; }
    act(p.userId, () => repo.resetPin(p.userId, pin), `PIN for ${p.username} reset. Tell them their new PIN privately.`);
  };

  const pending = (players ?? []).filter((p) => !p.approved && !p.isAdmin);
  const members = (players ?? []).filter((p) => p.approved || p.isAdmin);

  return (
    <>
      {pending.length > 0 && (
        <Card title={<>Waiting for approval <span className="nav-badge warn inline-badge">{pending.length}</span></>}>
          <ul className="rows">
            {pending.map((p) => (
              <li key={p.userId} className="row player-row">
                <div className="grow">
                  <div className="row-title">{p.username}</div>
                  <div className="hint">Signed up {new Date(p.createdAt).toLocaleString()}</div>
                </div>
                <div className="player-actions">
                  <button className="btn sm primary" disabled={busy === p.userId} onClick={() => approve(p)}>Approve</button>
                  <button className="btn sm ghost" disabled={busy === p.userId} onClick={() => reject(p)}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title={`Players${players ? ` (${members.length})` : ""}`}>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        {!players ? <p className="muted">Loading…</p> : (
          <ul className="rows">
            {members.map((p) => {
              const me = p.userId === user.userId;
              return (
                <li key={p.userId} className="row player-row">
                  <div className="grow">
                    <div className="row-title">
                      {p.username}
                      {me && <span className="badge rel-repeated" style={{ marginLeft: 8 }}>You</span>}
                      {p.isAdmin && <span className="badge rel-confirmed" style={{ marginLeft: 8 }}>Admin</span>}
                    </div>
                    <div className="hint">Joined {new Date(p.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="player-actions">
                    <button className="btn sm ghost" disabled={busy === p.userId} onClick={() => rename(p)}>Rename</button>
                    {!me && <button className="btn sm ghost" disabled={busy === p.userId} onClick={() => reset(p)}>Reset PIN</button>}
                    {!me && !p.isAdmin && <button className="btn sm danger" disabled={busy === p.userId} onClick={() => remove(p)}>Delete</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="hint">Renaming keeps the same PIN, admin role and shared data. You can't delete your own account here.</p>
      </Card>
    </>
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
      <h1>Settings</h1>

      <Card title="Account">
        <dl className="summary">
          <dt>Username</dt><dd>{user.username}</dd>
          <dt>Role</dt><dd>{isAdmin ? "Admin" : "Player"}</dd>
          <dt>Storage</dt><dd>{repo.mode === "supabase" ? "Shared database" : "This browser only (test mode)"}</dd>
        </dl>
        <button className="btn ghost full" onClick={() => go("device")}>Open My Device</button>
      </Card>

      <Card title="Change PIN"><ChangePin /></Card>

      {isAdmin && <Players />}

      <InstallCard />

      <Card title="Export">
        <p className="hint">Download data for backups or to analyse in a spreadsheet.</p>
        <div className="btn-col">
          <button className="btn" onClick={exportJson}>Everything (JSON)</button>
          <button className="btn" onClick={() => csv("prices", toCsv(observations.prices))} disabled={!observations.prices.length}>Price observations (CSV)</button>
          <button className="btn" onClick={() => csv("exp", toCsv(observations.exp))} disabled={!observations.exp.length}>XP observations (CSV)</button>
          <button className="btn" onClick={() => csv("level-requirements", toCsv(observations.levelReqs))} disabled={!observations.levelReqs.length}>Character level requirements (CSV)</button>
          <button className="btn" onClick={() => csv("purchases", toCsv(flattenPurchases(purchases)))} disabled={!purchases.length}>My purchase history (CSV)</button>
        </div>
      </Card>

      <Card title="Coming later">
        <ul className="tight muted">
          <li>Formula discovery (fit and test cost/XP formulas)</li>
          <li>Cheapest path to a target level</li>
          <li>Reboot planning — off until reboot rules are verified</li>
        </ul>
      </Card>

      <button className="btn danger full" onClick={signOut}>Sign out</button>
    </div>
  );
}
