import { ReactNode, useId } from "react";
import { Lookup, Reliability, RELIABILITY_LABEL } from "../domain/knowledge";

export const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString());

export function parseWhole(s: string): number | null {
  const t = s.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

/** Large, phone-friendly whole-number field. Value is kept as text so partial input is allowed. */
export function NumberField(props: {
  label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; error?: string | null;
  placeholder?: string; autoFocus?: boolean; compact?: boolean;
}) {
  const id = useId();
  return (
    <div className={`field${props.compact ? " compact" : ""}`}>
      <label htmlFor={id}>{props.label}</label>
      <input
        id={id} className="input mono" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
        value={props.value} placeholder={props.placeholder} autoFocus={props.autoFocus}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.error ? true : undefined}
      />
      {props.error ? <div className="field-error">{props.error}</div> : props.hint ? <div className="hint">{props.hint}</div> : null}
    </div>
  );
}

export function Stepper(props: { value: number; onChange: (v: number) => void; min?: number; max?: number | null; label: string }) {
  const min = props.min ?? 0;
  const max = props.max ?? null;
  return (
    <div className="stepper" role="group" aria-label={props.label}>
      <button type="button" className="step-btn" aria-label={`Lower ${props.label}`}
        disabled={props.value <= min} onClick={() => props.onChange(Math.max(min, props.value - 1))}>−</button>
      <input
        className="step-val mono" inputMode="numeric" pattern="[0-9]*" aria-label={props.label}
        value={String(props.value)}
        onChange={(e) => {
          const n = parseWhole(e.target.value);
          if (e.target.value === "") props.onChange(min);
          else if (n !== null) props.onChange(max !== null ? Math.min(max, n) : n);
        }}
      />
      <button type="button" className="step-btn" aria-label={`Raise ${props.label}`}
        disabled={max !== null && props.value >= max} onClick={() => props.onChange(props.value + 1)}>+</button>
    </div>
  );
}

const REL_CLASS: Record<Reliability, string> = {
  unknown: "rel-unknown", observed_once: "rel-once", repeated: "rel-repeated", confirmed: "rel-confirmed", conflict: "rel-conflict"
};

export function RelBadge({ r, count }: { r: Reliability; count?: number }) {
  return (
    <span className={`badge ${REL_CLASS[r]}`}>
      {RELIABILITY_LABEL[r]}{count && count > 1 && r !== "unknown" ? ` ×${count}` : ""}
    </span>
  );
}

export function ValueCell({ l, estimate }: { l: Lookup; estimate?: boolean }) {
  if (l.value === null) {
    return l.reliability === "conflict"
      ? <span className="v-missing">Conflict: {l.values.map(fmt).join(" / ")}</span>
      : <span className="v-missing">Unknown</span>;
  }
  return (
    <span className="v-known">
      <span className="mono">{fmt(l.value)}</span>
      {estimate ? <span className="badge rel-once">Estimate</span> : <RelBadge r={l.reliability} count={l.count} />}
    </span>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "bad" | "good"; children: ReactNode }) {
  return <div className={`notice ${tone}`} role={tone === "bad" ? "alert" : undefined}>{children}</div>;
}

export function Progress({ value, max }: { value: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max ?? undefined} aria-valuenow={value}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Card({ title, action, children }: { title?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(title || action) && <header className="card-head"><h2>{title}</h2>{action}</header>}
      {children}
    </section>
  );
}

export function Segmented<T extends string>(props: { options: { value: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={props.value === o.value}
          disabled={o.disabled} className={props.value === o.value ? "on" : ""} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
