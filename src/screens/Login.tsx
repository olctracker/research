import { FormEvent, useState } from "react";
import type { Repository, SessionUser } from "../data/repository";
import { checkCredentials } from "../data/repository";
import { Brand } from "../ui/Brand";
import { Notice, Segmented } from "../ui/components";
import { InstallCard } from "../ui/InstallCard";

type Mode = "signin" | "signup";

function PinInput(props: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id} className="input pin mono" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4}
        autoComplete={props.autoComplete} placeholder="••••" value={props.value}
        onChange={(e) => props.onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      />
    </div>
  );
}

export default function Login({ repo, onSignedIn }: { repo: Repository; onSignedIn: (u: SessionUser) => Promise<void> }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const bad = checkCredentials(username, pin);
    if (bad) { setErr(bad); return; }
    if (mode === "signup" && pin !== pin2) { setErr("The two PINs don't match"); return; }
    setBusy(true);
    try {
      const user = mode === "signin" ? await repo.signIn(username, pin) : await repo.signUp(username, pin);
      await onSignedIn(user);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <Brand large />
      <form className="card login-card" onSubmit={submit} noValidate>
        <Segmented label="Account" value={mode} onChange={(m) => { setMode(m); setErr(null); }} options={[
          { value: "signin", label: "Sign in" }, { value: "signup", label: "Create account" }
        ]} />
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" className="input" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            autoComplete="username" maxLength={20} value={username} placeholder="e.g. ghost_42"
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
          {mode === "signup" && <div className="hint">3–20 characters: letters, numbers or _. This name is shown on data you share.</div>}
        </div>
        <PinInput id="pin" label="4-digit PIN" value={pin} onChange={setPin} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
        {mode === "signup" && <PinInput id="pin2" label="Repeat PIN" value={pin2} onChange={setPin2} autoComplete="new-password" />}
        {mode === "signup" && <div className="hint">Don't reuse your game password or bank PIN. If you forget it, the admin can reset it.</div>}
        {err && <Notice tone="bad">{err}</Notice>}
        <button className="btn primary full" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        {repo.mode === "local" && (
          <Notice tone="warn">Test mode: accounts are stored only in this browser. The first account created becomes admin.</Notice>
        )}
      </form>
      <InstallCard compact />
    </main>
  );
}
