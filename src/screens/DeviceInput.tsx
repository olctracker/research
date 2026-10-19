import { useMemo, useState } from "react";
import { newId } from "../data/repository";
import { getEntry } from "../domain/catalog";
import { validateCharacter } from "../domain/exp";
import { parseApps, parseHome, parseStore } from "../domain/paste";
import { newLevelReqs } from "../domain/record";
import type { PriceObservation } from "../domain/types";
import { useApp } from "../state";
import { Card, fmt, Notice, Segmented } from "../ui/components";
import { go } from "../ui/router";

type Whose = "mine" | "friend";
type Msg = { tone: "good" | "bad" | "warn"; text: string } | null;

function PasteBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  async function fromClipboard() {
    try { onChange(await navigator.clipboard.readText()); } catch { /* browser said no: long-press the box and Paste */ }
  }
  return (
    <div className="paste-box">
      <textarea className="input paste-area" aria-label={label} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} rows={value ? 4 : 3} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
      <div className="report-actions">
        {"clipboard" in navigator && <button className="btn sm" onClick={fromClipboard}>Paste</button>}
        {value && <button className="btn sm ghost" onClick={() => onChange("")}>Clear</button>}
      </div>
    </div>
  );
}

export default function DeviceInput() {
  const { player, savePlayer, contribute, observations, user, kb } = useApp();
  const [whose, setWhose] = useState<Whose>("mine");
  const mine = whose === "mine";
  const levels = player?.levels ?? {};

  // ---------------- Level & XP ----------------
  const [homeText, setHomeText] = useState("");
  const [homeMsg, setHomeMsg] = useState<Msg>(null);
  const home = useMemo(() => (homeText.trim() ? parseHome(homeText) : null), [homeText]);
  const homeState = home && player ? {
    level: home.level ?? player.character.level,
    exp: home.exp,
    required: home.required
  } : null;
  const homeError = !homeState ? null
    : homeState.exp === null || homeState.required === null ? "Couldn't find your XP. It looks like 5870 / 17993."
    : validateCharacter({ level: homeState.level, exp: homeState.exp, required: homeState.required });

  async function saveHome() {
    if (!player || !homeState || homeError || homeState.exp === null || homeState.required === null) return;
    const character = { level: homeState.level, exp: homeState.exp, required: homeState.required };
    const next = { ...player, character, reboots: home?.reboots ?? player.reboots, updatedAt: new Date().toISOString() };
    try {
      await savePlayer(next);
      const reqs = newLevelReqs([character], observations, user.username, next.updatedAt, newId);
      if (reqs.length) await contribute({ prices: [], exp: [], levelReqs: reqs }).catch(() => {});
      setHomeMsg({ tone: "good", text: `Saved: LVL ${character.level} · ${fmt(character.exp)} / ${fmt(character.required)}${home?.reboots != null ? ` · R${home.reboots}` : ""}.` });
      setHomeText("");
    } catch (e) { setHomeMsg({ tone: "bad", text: e instanceof Error ? e.message : String(e) }); }
  }

  // ---------------- helpers ----------------
  const already = (o: PriceObservation) => observations.prices.some((p) =>
    p.status !== "rejected" && p.contributor === user.username && p.upgradeId === o.upgradeId && p.method === o.method &&
    p.fromLevel === o.fromLevel && p.toLevel === o.toLevel && p.cost === o.cost);
  const price = (o: Omit<PriceObservation, "id" | "contributor" | "createdAt" | "status" | "purchaseId" | "priceBasis">): PriceObservation => ({
    ...o, id: newId(), contributor: user.username, createdAt: new Date().toISOString(), status: "observed", purchaseId: null, priceBasis: "final"
  });

  // ---------------- Apps ----------------
  const [appsText, setAppsText] = useState("");
  const [appsMsg, setAppsMsg] = useState<Msg>(null);
  const apps = useMemo(() => (appsText.trim() ? parseApps(appsText) : null), [appsText]);
  const appsKeygen = apps?.keygenLevel ?? (mine ? levels.keygen ?? 0 : null);
  const appsChanges = (apps?.levels ?? []).filter((l) => (levels[l.upgradeId] ?? getEntry(l.upgradeId).startLevel) !== l.level);
  const appsKeys = (apps?.keys ?? []).map((k) => price({
    upgradeId: k.upgradeId, method: "download", fromLevel: k.fromLevel, toLevel: k.toLevel, cost: k.price, costType: "combined",
    keygenLevel: appsKeygen, notes: mine ? "Apps screen paste" : "Apps screen paste (a friend's screen)"
  }));
  const newKeys = appsKeys.filter((o) => !already(o));

  async function saveApps() {
    if (!player || !apps) return;
    try {
      const parts: string[] = [];
      if (mine && appsChanges.length) {
        const nextLevels = { ...levels };
        for (const l of appsChanges) nextLevels[l.upgradeId] = l.level;
        await savePlayer({ ...player, levels: nextLevels, updatedAt: new Date().toISOString() });
        parts.push(`updated ${appsChanges.length} level${appsChanges.length === 1 ? "" : "s"} on My Device`);
      }
      if (newKeys.length) {
        await contribute({ prices: newKeys, exp: [], levelReqs: [] });
        parts.push(`shared ${newKeys.length} Keygen price${newKeys.length === 1 ? "" : "s"}`);
      }
      setAppsMsg({ tone: "good", text: parts.length ? `Done: ${parts.join(" and ")}.` : "Nothing new: everything already matches." });
      setAppsText("");
    } catch (e) { setAppsMsg({ tone: "bad", text: e instanceof Error ? e.message : String(e) }); }
  }

  // ---------------- Store ----------------
  const [storeText, setStoreText] = useState("");
  const [storeMsg, setStoreMsg] = useState<Msg>(null);
  const store = useMemo(() => (storeText.trim() ? parseStore(storeText) : null), [storeText]);
  const storeRows = (store?.items ?? []).map((i) => {
    const e = getEntry(i.upgradeId);
    const obs = price({
      upgradeId: i.upgradeId, method: "store", fromLevel: i.oneTime ? 0 : i.toLevel - 1, toLevel: i.oneTime ? 1 : i.toLevel,
      cost: i.price, costType: i.oneTime ? "one_time" : "per_level", keygenLevel: null,
      notes: mine ? "Store screen paste" : "Store screen paste (a friend's screen)"
    });
    const known = i.oneTime ? kb.oneTimeItemPrice(i.upgradeId) : kb.storeLevelPrice(i.upgradeId, i.toLevel);
    const have = levels[i.upgradeId] ?? e.startLevel;
    const deviceOff = mine && !i.oneTime && have !== i.toLevel - 1;
    return { i, e, obs, dup: already(obs), known, deviceOff, have };
  });
  const storeNew = storeRows.filter((r) => !r.dup);
  const storeDeviceFix = storeRows.filter((r) => r.deviceOff);

  async function saveStore() {
    if (!player || !store) return;
    try {
      const parts: string[] = [];
      if (storeNew.length) {
        await contribute({ prices: storeNew.map((r) => r.obs), exp: [], levelReqs: [] });
        parts.push(`shared ${storeNew.length} store price${storeNew.length === 1 ? "" : "s"}`);
      }
      if (storeDeviceFix.length) {
        const nextLevels = { ...levels };
        for (const r of storeDeviceFix) nextLevels[r.i.upgradeId] = r.i.toLevel - 1;
        await savePlayer({ ...player, levels: nextLevels, updatedAt: new Date().toISOString() });
        parts.push(`fixed ${storeDeviceFix.length} level${storeDeviceFix.length === 1 ? "" : "s"} on My Device`);
      }
      setStoreMsg({ tone: "good", text: parts.length ? `Done: ${parts.join(" and ")}. Thanks!` : "Nothing new: you've already shared all of these." });
      setStoreText("");
    } catch (e) { setStoreMsg({ tone: "bad", text: e instanceof Error ? e.message : String(e) }); }
  }

  if (!player) return null;
  const name = (id: string) => getEntry(id).name;

  return (
    <div className="screen">
      <h1>Device Input</h1>
      <p className="lead">Copy straight from the game and paste here. In Hack EX2, press and hold the screen, tap <b>Select all</b>, then <b>Copy</b>. Nothing is saved until you check it and tap the button.</p>

      <Segmented label="Whose screen are you pasting?" value={whose} onChange={setWhose} options={[
        { value: "mine", label: "My game" }, { value: "friend", label: "A friend's game" }
      ]} />
      {!mine && <Notice tone="info">Friend's screens only share prices. Your device and XP aren't changed.</Notice>}

      {mine && (
        <Card title="Level & XP (Home screen)">
          <PasteBox label="Home screen or XP" value={homeText} onChange={(v) => { setHomeText(v); setHomeMsg(null); }}
            placeholder={"Paste your Home screen, or just type\n20262 / 20978"} />
          {homeState && !homeError && (
            <div className="found">
              <span>LVL <b className="mono">{homeState.level}</b>{home?.level == null && <span className="hint"> (unchanged)</span>}</span>
              <span>XP <b className="mono">{fmt(homeState.exp)} / {fmt(homeState.required)}</b></span>
              {home?.reboots != null && <span>R<b className="mono">{home.reboots}</b></span>}
            </div>
          )}
          {homeError && <Notice tone="warn">{homeError}</Notice>}
          {homeMsg && <Notice tone={homeMsg.tone}>{homeMsg.text}</Notice>}
          {homeState && !homeError && <button className="btn primary full" onClick={saveHome}>Save to My Device</button>}
          <p className="hint">Now: LVL {player.character.level} · {fmt(player.character.exp)} / {fmt(player.character.required)}</p>
        </Card>
      )}

      <Card title="Apps screen">
        <PasteBox label="Apps screen" value={appsText} onChange={(v) => { setAppsText(v); setAppsMsg(null); }}
          placeholder={"Paste the whole Apps screen\n(Installed Applications)"} />
        {apps?.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
        {apps && apps.levels.length > 0 && (
          <>
            {mine && (
              appsChanges.length ? (
                <>
                  <div className="found-title">My Device will change</div>
                  <ul className="found-list">
                    {appsChanges.map((l) => (
                      <li key={l.upgradeId}><span>{name(l.upgradeId)}</span><span className="mono">{levels[l.upgradeId] ?? getEntry(l.upgradeId).startLevel} → <b>{l.level}</b></span></li>
                    ))}
                  </ul>
                </>
              ) : <p className="hint">✓ All {apps.levels.length} app levels already match My Device.</p>
            )}
            {appsKeys.length > 0 && (
              <>
                <div className="found-title">Keygen prices {appsKeygen != null && <span className="hint">(Keygen {appsKeygen})</span>}</div>
                <ul className="found-list">
                  {appsKeys.map((k) => (
                    <li key={k.upgradeId}><span>{name(k.upgradeId)} <span className="hint mono">Lv {k.fromLevel}→{k.toLevel}</span></span>
                      <span className="mono">{fmt(k.cost)}{already(k) && <span className="hint"> · already shared</span>}</span></li>
                  ))}
                </ul>
              </>
            )}
            {!appsKeys.length && <p className="hint">No LOCKED keys on this screen, so no Keygen prices to share.</p>}
            {appsMsg && <Notice tone={appsMsg.tone}>{appsMsg.text}</Notice>}
            {((mine && appsChanges.length > 0) || newKeys.length > 0) && (
              <button className="btn primary full" onClick={saveApps}>
                {[mine && appsChanges.length ? "Update My Device" : null, newKeys.length ? `Share ${newKeys.length} price${newKeys.length === 1 ? "" : "s"}` : null].filter(Boolean).join(" & ")}
              </button>
            )}
          </>
        )}
        {!apps && appsMsg && <Notice tone={appsMsg.tone}>{appsMsg.text}</Notice>}
      </Card>

      <Card title="Store">
        <PasteBox label="Store screen" value={storeText} onChange={(v) => { setStoreText(v); setStoreMsg(null); }}
          placeholder={"Paste the whole Store (Upgrades tab)"} />
        {store?.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
        {storeRows.length > 0 && (
          <>
            <ul className="found-list">
              {storeRows.map((r) => (
                <li key={r.i.upgradeId}>
                  <span>{r.e.name}{r.i.label !== r.e.name && <span className="hint"> ({r.i.label})</span>} <span className="hint mono">{r.i.oneTime ? "" : `Lv ${r.i.toLevel}`}</span>
                    {r.deviceOff && <span className="block warn-text small">My Device says {r.have}; the store means you're on {r.i.toLevel - 1}</span>}
                  </span>
                  <span className="mono">{fmt(r.i.price)}
                    {r.dup ? <span className="hint"> · already shared</span>
                      : r.known.reliability !== "unknown" && r.known.value !== r.i.price && r.known.value !== null ? <span className="bad-text small block">others saw {fmt(r.known.value)}</span>
                      : r.known.reliability === "unknown" ? <span className="good-text small block">new!</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            {store!.skipped.length > 0 && <p className="hint">Skipped: {store!.skipped.join(" · ")}</p>}
            {storeDeviceFix.length > 0 && <Notice tone="warn">{storeDeviceFix.length} level{storeDeviceFix.length === 1 ? "" : "s"} on My Device {storeDeviceFix.length === 1 ? "doesn't" : "don't"} match the store. Saving will fix {storeDeviceFix.length === 1 ? "it" : "them"} too.</Notice>}
            {storeMsg && <Notice tone={storeMsg.tone}>{storeMsg.text}</Notice>}
            {(storeNew.length > 0 || storeDeviceFix.length > 0) && (
              <button className="btn primary full" onClick={saveStore}>
                {[storeNew.length ? `Share ${storeNew.length} store price${storeNew.length === 1 ? "" : "s"}` : null, storeDeviceFix.length ? "Fix My Device" : null].filter(Boolean).join(" & ")}
              </button>
            )}
          </>
        )}
        {!store && storeMsg && <Notice tone={storeMsg.tone}>{storeMsg.text}</Notice>}
      </Card>

      <p className="hint">Wrong numbers saved? Tap the value in the <button className="link" onClick={() => go("data")}>Data Table</button> to remove your report.</p>
    </div>
  );
}
