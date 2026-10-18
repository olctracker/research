import { useEffect, useMemo, useState } from "react";
import type { Flag, ObservationType } from "../data/repository";
import { newId } from "../data/repository";
import { CATALOG, CATEGORY_LABEL, getEntry } from "../domain/catalog";
import {
  computeCompleteness, DataPoint, OPEN_QUESTIONS, SERIES_LABEL, SeriesCoverage, SeriesKind, summarize
} from "../domain/completeness";
import { Reliability, RELIABILITY_LABEL } from "../domain/knowledge";
import type { Category, ExpObservation, LevelRequirementObservation, ObservationStatus, PriceObservation } from "../domain/types";
import { useApp } from "../state";
import { Card, fmt, Notice, NumberField, parseWhole, RelBadge, Segmented } from "../ui/components";
import Conflicts from "./Conflicts";

type Tab = "coverage" | "conflicts" | "missing" | "observations" | "add";

export default function Research() {
  const { conflicts, isAdmin } = useApp();
  const [tab, setTab] = useState<Tab>(isAdmin && conflicts.length ? "conflicts" : "coverage");
  return (
    <div className="screen">
      <h1>Research</h1>
      <Segmented label="Research section" value={tab} onChange={setTab} options={[
        { value: "coverage", label: "Coverage" },
        { value: "conflicts", label: conflicts.length ? `Conflicts ${conflicts.length}` : "Conflicts" },
        { value: "missing", label: "Missing" },
        { value: "observations", label: "Records" }, { value: "add", label: "Add" }
      ]} />
      {tab === "coverage" && <Coverage />}
      {tab === "conflicts" && <Conflicts />}
      {tab === "missing" && <Missing />}
      {tab === "observations" && <Observations />}
      {tab === "add" && <AddObservation onAdded={() => setTab("observations")} />}
    </div>
  );
}

const ORDER: Reliability[] = ["confirmed", "repeated", "observed_once", "conflict", "unknown"];
const SEG_CLASS: Record<Reliability, string> = {
  confirmed: "seg-confirmed", repeated: "seg-repeated", observed_once: "seg-once", conflict: "seg-conflict", unknown: "seg-unknown"
};

function StackBar({ counts, total }: { counts: Record<Reliability, number>; total: number }) {
  return (
    <div className="stack" aria-label={ORDER.map((r) => `${RELIABILITY_LABEL[r]} ${counts[r]}`).join(", ")}>
      {ORDER.map((r) => counts[r] > 0 && <div key={r} className={SEG_CLASS[r]} style={{ width: `${(counts[r] / total) * 100}%` }} />)}
    </div>
  );
}

function Legend() {
  return (
    <div className="legend-row">
      {ORDER.map((r) => <span key={r}><i className={SEG_CLASS[r]} /> {RELIABILITY_LABEL[r]}</span>)}
    </div>
  );
}

const rangeText = (s: SeriesCoverage) =>
  s.rangeKind === "single" ? "one item" :
  `levels ${s.rangeFrom}–${s.rangeTo}${s.rangeKind === "cap" ? " (to max)" : " (no known cap — partial range)"}`;

function Coverage() {
  const { kb } = useApp();
  const rows = useMemo(() => computeCompleteness(kb), [kb]);
  const sum = summarize(rows);
  const byUpgrade = new Map<string, SeriesCoverage[]>();
  for (const r of rows) {
    const k = r.upgradeId ?? "character";
    byUpgrade.set(k, [...(byUpgrade.get(k) ?? []), r]);
  }
  const notApplicable = CATALOG.filter((e) => !e.download).map((e) => e.name).join(", ");

  return (
    <>
      <Card title="Overall">
        <div className="stat-row">
          <div><div className="stat mono">{fmt(sum.known)}</div><div className="hint">of {fmt(sum.total)} data points known</div></div>
          <div><div className="stat mono">{sum.percentKnown}%</div><div className="hint">coverage of tracked range</div></div>
          <div><div className="stat mono">{fmt(sum.counts.conflict)}</div><div className="hint">conflicts</div></div>
        </div>
        <StackBar counts={sum.counts} total={sum.total} />
        <Legend />
        <p className="hint">
          Tracked range: capped upgrades to their max; uncapped software to level 20 (or the highest level anyone has recorded);
          character levels 1–30. Coverage beyond that is unknown, not zero.
          Downloads are <b>not applicable</b> for {notApplicable}.
        </p>
      </Card>
      {[...byUpgrade.entries()].map(([k, list]) => (
        <Card key={k} title={k === "character" ? "Character levels" : getEntry(k).name}>
          {list.map((s) => {
            const known = s.total - s.counts.unknown - s.counts.conflict;
            return (
              <div key={s.series} className="cov">
                <div className="cov-head">
                  <span>{SERIES_LABEL[s.series]}</span>
                  <span className="mono muted">{known}/{s.total}</span>
                </div>
                <StackBar counts={s.counts} total={s.total} />
                <div className="hint">{rangeText(s)}</div>
              </div>
            );
          })}
        </Card>
      ))}
      <Card title="Open questions">
        <ul className="rows">
          {OPEN_QUESTIONS.map((q) => (
            <li key={q.title} className="row"><div><div className="row-title">{q.title} <span className="badge rel-unknown">Unconfirmed</span></div><div className="hint">{q.detail}</div></div></li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Missing() {
  const { kb } = useApp();
  const rows = useMemo(() => computeCompleteness(kb), [kb]);
  const [upgrade, setUpgrade] = useState("all");
  const [category, setCategory] = useState<Category | "character" | "all">("all");
  const [method, setMethod] = useState<"all" | "store" | "download">("all");
  const [series, setSeries] = useState<SeriesKind | "all">("all");
  const [rel, setRel] = useState<"needs" | Reliability>("needs");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const points = useMemo(() => {
    const lo = parseWhole(from); const hi = parseWhole(to);
    return rows.flatMap((r) => r.points).filter((p: DataPoint) =>
      (upgrade === "all" || (p.upgradeId ?? "character") === upgrade) &&
      (category === "all" || p.category === category) &&
      (method === "all" || p.method === method) &&
      (series === "all" || p.series === series) &&
      (rel === "needs" ? p.lookup.reliability === "unknown" || p.lookup.reliability === "conflict" : p.lookup.reliability === rel) &&
      (lo === null || p.level >= lo) && (hi === null || p.level <= hi));
  }, [rows, upgrade, category, method, series, rel, from, to]);

  return (
    <>
      <Card title="Filters">
        <div className="filters">
          <label>Upgrade<select className="input" value={upgrade} onChange={(e) => setUpgrade(e.target.value)}>
            <option value="all">All</option><option value="character">Character levels</option>
            {CATALOG.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select></label>
          <label>Category<select className="input" value={category} onChange={(e) => setCategory(e.target.value as Category | "all")}>
            <option value="all">All</option>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            <option value="character">Character</option>
          </select></label>
          <label>Method<select className="input" value={method} onChange={(e) => setMethod(e.target.value as "all")}>
            <option value="all">All</option><option value="store">Store</option><option value="download">Keygen</option>
          </select></label>
          <label>Data type<select className="input" value={series} onChange={(e) => setSeries(e.target.value as SeriesKind | "all")}>
            <option value="all">All</option>
            {(Object.keys(SERIES_LABEL) as SeriesKind[]).map((s) => <option key={s} value={s}>{SERIES_LABEL[s]}</option>)}
          </select></label>
          <label>Status<select className="input" value={rel} onChange={(e) => setRel(e.target.value as Reliability)}>
            <option value="needs">Needs data (unknown or conflict)</option>
            {ORDER.map((r) => <option key={r} value={r}>{RELIABILITY_LABEL[r]}</option>)}
          </select></label>
          <div className="grid2">
            <NumberField compact label="From level" value={from} onChange={setFrom} />
            <NumberField compact label="To level" value={to} onChange={setTo} />
          </div>
        </div>
      </Card>
      <Card title={`${fmt(points.length)} data points`}>
        <ul className="rows">
          {points.slice(0, 200).map((p) => (
            <li key={`${p.series}-${p.upgradeId}-${p.level}`} className="row">
              <div className="grow">
                <div className="row-title">{p.upgradeName} · {SERIES_LABEL[p.series]}{p.series !== "one_time_price" && p.series !== "one_time_exp" ? ` · level ${p.level}` : ""}</div>
                {p.lookup.reliability === "conflict" && <div className="hint">Seen: {p.lookup.values.map(fmt).join(" / ")}</div>}
              </div>
              <RelBadge r={p.lookup.reliability} count={p.lookup.count} />
            </li>
          ))}
        </ul>
        {points.length > 200 && <p className="hint">Showing the first 200. Narrow the filters to see more.</p>}
      </Card>
    </>
  );
}

type AnyObs =
  | { type: "price"; o: PriceObservation }
  | { type: "exp"; o: ExpObservation }
  | { type: "level_req"; o: LevelRequirementObservation };

function describe(a: AnyObs): string {
  if (a.type === "level_req") return `Character level ${a.o.level} needs ${fmt(a.o.expRequired)} XP`;
  const e = getEntry(a.o.upgradeId);
  const lv = e.kind === "one_time" ? "" : a.o.toLevel - a.o.fromLevel > 1 || a.o.method === "download" ? ` ${a.o.fromLevel}→${a.o.toLevel}` : ` L${a.o.toLevel}`;
  if (a.type === "price") {
    const kind = a.o.costType === "component" ? "download component" : a.o.method === "download" ? "download total" : "store";
    return `${e.name}${lv} ${kind} cost ${fmt(a.o.cost)}${a.o.priceBasis === "before_discount" ? " (list price)" : ""}`;
  }
  return `${e.name}${lv} ${a.o.method} XP ${fmt(a.o.exp)}${a.o.expBasis === "per_transaction" && a.o.method === "store" ? " (combined)" : ""} · ${a.o.source}`;
}

function Observations() {
  const { observations, repo, isAdmin, reloadObservations } = useApp();
  const [filter, setFilter] = useState("all");
  const [flags, setFlags] = useState<Flag[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { repo.listFlags().then(setFlags).catch(() => setFlags([])); }, [repo]);

  const all: AnyObs[] = useMemo(() => [
    ...observations.prices.map((o) => ({ type: "price" as const, o })),
    ...observations.exp.map((o) => ({ type: "exp" as const, o })),
    ...observations.levelReqs.map((o) => ({ type: "level_req" as const, o }))
  ].filter((a) => filter === "all" || (a.type === "level_req" ? filter === "character" : a.o.upgradeId === filter))
   .sort((a, b) => b.o.createdAt.localeCompare(a.o.createdAt)), [observations, filter]);

  const openFlags = (id: string) => flags.filter((f) => f.observationId === id && !f.resolved);

  async function flag(a: AnyObs) {
    const reason = prompt("What looks wrong with this record?");
    if (!reason?.trim()) return;
    try {
      await repo.flagObservation(a.type as ObservationType, a.o.id, reason.trim().slice(0, 500));
      setFlags(await repo.listFlags());
      setMsg("Flagged for review. The record itself is kept.");
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  }

  async function setStatus(a: AnyObs, s: ObservationStatus) {
    try { await repo.setObservationStatus(a.type, a.o.id, s); await reloadObservations(); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  }

  async function resolve(id: string) {
    try { await repo.resolveFlag(id); setFlags(await repo.listFlags()); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <>
      <Card>
        <label className="field">Show
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Everything</option><option value="character">Character levels</option>
            {CATALOG.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <p className="hint">Raw records are never overwritten. Disagreeing records are all kept and shown as conflicts.</p>
      </Card>
      {msg && <Notice tone="info">{msg}</Notice>}
      <Card title={`${fmt(all.length)} records`}>
        <ul className="rows">
          {all.slice(0, 300).map((a) => {
            const f = openFlags(a.o.id);
            return (
              <li key={a.o.id} className="row obs">
                <div className="grow">
                  <div className="row-title">{describe(a)}</div>
                  <div className="hint">
                    {a.o.contributor} · {new Date(a.o.createdAt).toLocaleDateString()}
                    {a.type === "price" && a.o.keygenLevel !== null ? ` · Keygen ${a.o.keygenLevel}` : ""}
                    {a.o.reboots != null ? ` · R${a.o.reboots}` : ""}
                    {a.o.notes ? ` · ${a.o.notes}` : ""}
                  </div>
                  {f.map((x) => (
                    <div key={x.id} className="flag">⚑ {x.reason}{isAdmin && <button className="link" onClick={() => resolve(x.id)}>Resolve</button>}</div>
                  ))}
                </div>
                <div className="obs-actions">
                  <span className={`badge st-${a.o.status}`}>{a.o.status}</span>
                  {isAdmin ? (
                    <select className="input sm" value={a.o.status} aria-label="Status" onChange={(e) => setStatus(a, e.target.value as ObservationStatus)}>
                      <option value="observed">observed</option><option value="confirmed">confirmed</option><option value="rejected">rejected</option>
                    </select>
                  ) : (
                    <button className="btn sm ghost" onClick={() => flag(a)}>Flag</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {all.length > 300 && <p className="hint">Showing the newest 300. Filter by upgrade or export to see everything.</p>}
      </Card>
    </>
  );
}

type AddKind = "store_price" | "store_list_price" | "store_exp" | "download_total" | "download_component" | "download_exp" | "one_time_price" | "one_time_exp" | "level_req";
const ADD_LABEL: Record<AddKind, string> = {
  store_price: "Store price (what you paid)",
  store_list_price: "Store list price before discount",
  store_exp: "Store XP for one level",
  download_total: "Keygen price",
  download_component: "Keygen cost component (one level)",
  download_exp: "Keygen XP",
  one_time_price: "One-time item price",
  one_time_exp: "One-time item XP",
  level_req: "XP needed for a character level"
};

function choicesFor(kind: AddKind) {
  return CATALOG.filter((e) =>
    kind === "one_time_price" || kind === "one_time_exp" ? e.kind === "one_time" :
    kind.startsWith("download") ? e.download :
    kind === "store_list_price" ? e.defensiveDiscount :
    e.kind === "level");
}

function AddObservation({ onAdded }: { onAdded: () => void }) {
  const { contribute, player, user } = useApp();
  const [kind, setKind] = useState<AddKind>("store_price");
  const [upgradeId, setUpgradeId] = useState("spam");
  const [fromL, setFromL] = useState("");
  const [toL, setToL] = useState("");
  const [value, setValue] = useState("");
  const [keygen, setKeygen] = useState(String(player?.levels.keygen ?? ""));
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isChar = kind === "level_req";
  const isOnce = kind === "one_time_price" || kind === "one_time_exp";
  const isRange = kind === "download_total" || kind === "download_exp";
  const isDownload = kind.startsWith("download");
  const choices = choicesFor(kind);

  function changeKind(k: AddKind) {
    setKind(k);
    const list = choicesFor(k);
    if (k !== "level_req" && !list.some((c) => c.id === upgradeId) && list[0]) setUpgradeId(list[0].id);
  }

  async function submit() {
    setErr(null);
    const v = parseWhole(value);
    if (v === null) { setErr("Enter the value as a whole number"); return; }
    const now = new Date().toISOString();
    const contributor = user.username;
    const base = { id: newId(), contributor, createdAt: now, status: "observed" as const, notes: notes.trim().slice(0, 500) };
    try {
      if (isChar) {
        const lvl = parseWhole(toL);
        if (!lvl || lvl < 1) { setErr("Enter the character level"); return; }
        if (v <= 0) { setErr("XP needed must be more than 0"); return; }
        setBusy(true);
        await contribute({ prices: [], exp: [], levelReqs: [{ ...base, level: lvl, expRequired: v }] });
      } else {
        const e = getEntry(upgradeId);
        const to = isOnce ? 1 : parseWhole(toL);
        const from = isOnce ? 0 : isRange ? parseWhole(fromL) : to === null ? null : to - 1;
        if (to === null || from === null || to <= from) { setErr(isRange ? "Enter from and to levels (to must be higher)" : "Enter the level"); return; }
        if (e.maxLevel !== null && to > e.maxLevel) { setErr(`${e.name} maxes out at level ${e.maxLevel}`); return; }
        const kg = parseWhole(keygen);
        setBusy(true);
        if (kind.endsWith("exp")) {
          const o: ExpObservation = {
            ...base, upgradeId, method: isDownload ? "download" : "store", fromLevel: from, toLevel: to, exp: v,
            expBasis: isDownload ? "per_transaction" : "per_level", source: "entered", purchaseId: null
          };
          await contribute({ prices: [], exp: [o], levelReqs: [] });
        } else {
          const o: PriceObservation = {
            ...base, upgradeId, method: isDownload ? "download" : "store", fromLevel: from, toLevel: to, cost: v,
            costType: kind === "download_total" ? "combined" : kind === "download_component" ? "component" : isOnce ? "one_time" : "per_level",
            priceBasis: kind === "store_list_price" ? "before_discount" : "final",
            keygenLevel: isDownload ? kg : null, purchaseId: null
          };
          await contribute({ prices: [o], exp: [], levelReqs: [] });
        }
      }
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <Card title="Add an observation">
      <p className="hint">For prices you saw in the game outside the purchase flow — useful for high-level players. Upgrade XP isn't shown by the game, so it's only worked out from purchases.</p>
      <label className="field">What did you see?
        <select className="input" value={kind} onChange={(e) => changeKind(e.target.value as AddKind)}>
          {(Object.keys(ADD_LABEL) as AddKind[]).filter((k) => !k.endsWith("_exp")).map((k) => <option key={k} value={k}>{ADD_LABEL[k]}</option>)}
        </select>
      </label>
      {!isChar && (
        <label className="field">Upgrade
          <select className="input" value={upgradeId} onChange={(e) => setUpgradeId(e.target.value)}>
            {choices.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
      )}
      {!isOnce && (
        <div className="grid2">
          {isRange && <NumberField compact label="From level" value={fromL} onChange={setFromL} />}
          <NumberField compact label={isChar ? "Character level" : isRange ? "To level" : "Level bought"} value={toL} onChange={setToL} />
        </div>
      )}
      <NumberField label={kind.endsWith("exp") ? "XP" : isChar ? "XP needed for next level" : "Cost"} value={value} onChange={setValue} />
      {isDownload && <NumberField compact label="Your Keygen level (optional)" value={keygen} onChange={setKeygen} />}
      <div className="field">
        <label htmlFor="obs-notes">Notes / evidence (optional)</label>
        <input id="obs-notes" className="input" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {err && <Notice tone="bad">{err}</Notice>}
      <button className="btn primary full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save observation"}</button>
    </Card>
  );
}
