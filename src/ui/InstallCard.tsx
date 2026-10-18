import { Card } from "./components";
import { useInstall } from "./install";

export function InstallCard({ compact }: { compact?: boolean }) {
  const inst = useInstall();
  if (inst.installed) return compact ? null : <Card title="App installed"><p className="hint">You're using the installed app.</p></Card>;
  const body = (
    <>
      {inst.canPrompt && <button className="btn primary full" onClick={inst.prompt}>Install app</button>}
      {inst.ios ? (
        <ol className="steps">
          <li>Open this page in <b>Safari</b>.</li>
          <li>Tap the <b>Share</b> button <span aria-hidden="true">⬆︎</span>.</li>
          <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        </ol>
      ) : !inst.canPrompt ? (
        <ol className="steps">
          <li>Open this page in <b>Chrome</b>.</li>
          <li>Tap the menu <b>⋮</b>.</li>
          <li>Choose <b>Add to Home screen</b> or <b>Install app</b>.</li>
        </ol>
      ) : null}
    </>
  );
  if (compact) return <details className="install-compact"><summary>Install on your phone</summary>{body}</details>;
  return <Card title="Install on your phone">{body}</Card>;
}
