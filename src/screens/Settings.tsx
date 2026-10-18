import { flattenPurchases, toCsv, toJson } from "../domain/export";
import { useApp } from "../state";
import { Card, download, Notice } from "../ui/components";
import { go } from "../ui/router";

const stamp = () => new Date().toISOString().slice(0, 10);

export default function Settings() {
  const { repo, userId, isAdmin, player, purchases, observations } = useApp();

  const exportJson = () => download(`hackex2-export-${stamp()}.json`, toJson({
    exportedAt: new Date().toISOString(), app: "hackex2-upgrade-tracker", formatVersion: 1,
    player, purchases, observations
  }), "application/json");

  const csv = (name: string, text: string) => download(`hackex2-${name}-${stamp()}.csv`, text, "text/csv");

  return (
    <div className="screen">
      <h1>Settings</h1>

      <Card title="Account">
        <dl className="summary">
          <dt>Alias</dt><dd>{player?.alias || <span className="muted">none</span>}</dd>
          <dt>Storage</dt><dd>{repo.mode === "supabase" ? "Shared database (Supabase)" : "This browser only"}</dd>
          <dt>Player ID</dt><dd className="mono small">{userId.slice(0, 8)}…</dd>
          {isAdmin && repo.mode === "supabase" && <><dt>Role</dt><dd>Admin</dd></>}
        </dl>
        {repo.mode === "supabase" && (
          <Notice tone="info">
            You're signed in with a private anonymous session on this device. Clearing site data or using another
            browser starts a new, empty profile, so export a backup now and then.
          </Notice>
        )}
        <button className="btn ghost full" onClick={() => go("setup")}>Edit game state</button>
      </Card>

      <Card title="Export">
        <p className="hint">Download your data for backups or to analyse in a spreadsheet or another tool.</p>
        <div className="btn-col">
          <button className="btn" onClick={exportJson}>Everything (JSON)</button>
          <button className="btn" onClick={() => csv("prices", toCsv(observations.prices))} disabled={!observations.prices.length}>Price observations (CSV)</button>
          <button className="btn" onClick={() => csv("exp", toCsv(observations.exp))} disabled={!observations.exp.length}>EXP observations (CSV)</button>
          <button className="btn" onClick={() => csv("level-requirements", toCsv(observations.levelReqs))} disabled={!observations.levelReqs.length}>Character level requirements (CSV)</button>
          <button className="btn" onClick={() => csv("purchases", toCsv(flattenPurchases(purchases)))} disabled={!purchases.length}>My purchase history (CSV)</button>
        </div>
      </Card>

      <Card title="Add to home screen">
        <ul className="tight">
          <li><b>Android (Chrome):</b> menu ⋮ → Add to Home screen.</li>
          <li><b>iPhone (Safari):</b> Share → Add to Home Screen.</li>
        </ul>
      </Card>

      <Card title="Coming later">
        <ul className="tight">
          <li>Formula discovery (fit and test cost/EXP formulas)</li>
          <li>Cheapest path to a target level</li>
          <li>Reboot planning — disabled until reboot rules are verified</li>
        </ul>
      </Card>
    </div>
  );
}
