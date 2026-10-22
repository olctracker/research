import { useMemo, useState } from "react";
import { FORMULA_SHEET } from "../domain/formulaSheet";
import { buildChecklist, failed, isDone } from "../domain/checklist";
import { useApp } from "../state";
import { Card } from "../ui/components";

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    // Older phones: copy through a hidden text box.
    try {
      const t = document.createElement("textarea");
      t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy"); document.body.removeChild(t); return ok;
    } catch { return false; }
  }
}

function FormulaSheet() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [open, setOpen] = useState(false);
  async function copy() {
    const ok = await copyText(FORMULA_SHEET);
    setState(ok ? "copied" : "failed");
    if (ok) setTimeout(() => setState("idle"), 2500);
  }
  return (
    <Card title="Formula Sheet">
      <p className="hint">Every verified formula in one simple list, ready to share.</p>
      <button className="btn primary full" onClick={copy}>{state === "copied" ? "Copied ✓" : "Copy all formulas"}</button>
      {state === "failed" && <p className="hint bad-text">Your browser blocked copying. Open the sheet below, press and hold the text, and choose Select all → Copy.</p>}
      <button className="link" onClick={() => setOpen((o) => !o)}>{open ? "Hide the sheet" : "Show the sheet"}</button>
      {open && <pre className="formula-sheet">{FORMULA_SHEET}</pre>}
    </Card>
  );
}

export default function Formulas() {
  const { observations, kb } = useApp();
  const groups = useMemo(() => buildChecklist(observations, kb), [observations, kb]);
  const all = groups.flatMap((g) => g.items);
  const done = all.filter(isDone).length;
  const broken = all.filter(failed).length;

  return (
    <div className="screen">
      <h1>Formula Checklist</h1>
      <p className="lead">What we still need to test before each formula is 100%. Items tick themselves off when someone records matching data, and show whether the game agreed with the formula.</p>

      <FormulaSheet />

      <div className={`summary-bar${broken ? " warn" : done === all.length ? " good" : ""}`}>
        <span className="summary-count mono">{done}/{all.length}</span>
        <span className="grow">{broken ? `${broken} test${broken === 1 ? "" : "s"} didn't match the formula. Export the data so the formula can be fixed.` : done === all.length ? "Everything tested!" : "tests done"}</span>
      </div>

      {groups.map((g) => {
        const d = g.items.filter(isDone).length;
        return (
          <Card key={g.id} title={<>{g.title} <span className="hint">· {d}/{g.items.length}</span></>}>
            <div className="formula-box">
              <div className="mono small">{g.formula}</div>
              <div className="hint">{g.status}</div>
            </div>
            <ul className="checklist">
              {g.items.map((i) => {
                const ok = isDone(i);
                const bad = failed(i);
                return (
                  <li key={i.id} className={`check-item${ok ? " done" : ""}${bad ? " bad" : ""}`}>
                    <span className="check-box" aria-hidden="true">{bad ? "✗" : ok ? "✓" : ""}</span>
                    <div className="grow">
                      <div className="row-title">{i.title}</div>
                      {!ok && <div className="hint">{i.how}</div>}
                      {i.evidence.slice(0, 4).map((e, k) => (
                        <div key={k} className={`hint evidence ${e.match === true ? "good-text" : e.match === false ? "bad-text" : ""}`}>
                          {e.match === true ? "✓ " : e.match === false ? "✗ " : "• "}{e.text}{e.note ? ` — ${e.note}` : e.match === true ? " — matches" : ""}
                        </div>
                      ))}
                      {i.evidence.length > 4 && <div className="hint">+{i.evidence.length - 4} more</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
      <p className="hint">A ✗ means the game disagreed with the formula. Export the data (Settings → Export) and send it to Claude to rework that formula.</p>
    </div>
  );
}
