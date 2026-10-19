import { useState } from "react";
import { Brand } from "../ui/Brand";
import { Notice } from "../ui/components";

/** Shown to new accounts until the admin approves them. */
export default function Pending({ username, onCheck, onSignOut }: {
  username: string; onCheck: () => Promise<boolean>; onSignOut: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <main className="login">
      <Brand large />
      <div className="card login-card pending">
        <div className="pending-icon" aria-hidden="true">⏳</div>
        <h1>Waiting for approval</h1>
        <p>Your account <b className="mono">{username}</b> has been created. The admin needs to approve it before you can see and add data.</p>
        <p className="hint">Let the admin know you've signed up. You can close the app — just sign in again later.</p>
        {msg && <Notice tone="info">{msg}</Notice>}
        <button className="btn primary full" disabled={busy} onClick={async () => {
          setBusy(true); setMsg(null);
          try { if (!(await onCheck())) setMsg("Not approved yet. Try again a bit later."); }
          catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
          finally { setBusy(false); }
        }}>{busy ? "Checking…" : "Check again"}</button>
        <button className="btn ghost full" onClick={onSignOut}>Sign out</button>
      </div>
    </main>
  );
}
