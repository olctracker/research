import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { parseApps, parseHome, parseStore } from "../src/domain/paste";

// Typed from real screenshots (Oct 18 2026). Copying from the game gives one item per line.
const HOME = `> Hilltop
MY DEVICE
R3
LVL 24 // REP 1351
5,348 SCORE
353,621 LIFETIME
// XP PROGRESS
5870 / 17993
33%
// CRYPTO
13,103
// DAILY MISSIONS
Bypass 6 Unique Firewalls
20/6
1,000 Crypto + 200 XP + 90 Rep`;

const APPS_FRIEND = `▼ Installed Applications
Antivirus
LVL 20
Firewall
LVL 1
LOCKED
LVL 20 available
16,090 Crypto
Password Encryptor
LVL 1
LOCKED
LVL 20 available
22,123 Crypto
Proxy
STEALTH 67h 18m
LVL 20
LOCKED
LVL 44 available
52,375 Crypto
Spam
6,400/hr
LVL 20
LOCKED
LVL 32 available
57,451 Crypto
Siphon
LVL 17
LOCKED
LVL 30 available
49,411 Crypto
Keygen
LVL 30
Message Encryptor
Trace
NOT INSTALLED
LOCKED
LVL 35 available
38,898 Crypto`;

const APPS_MINE = `// APPS
Wallet: 15,709
SPAM 11 / 44 Botnet - Hive 1,100/hr 26,400/day >
SIPHON 8 11,406 siphoned >
Installed Applications
Antivirus
LVL 1
Firewall
LVL 21 (+3)
Password Encryptor
LVL 1 (+3)
Proxy ACTIVE 43h 17m
LVL 20
Spam 1,100/hr
LVL 20
Siphon 11,406 siphoned
LVL 17
Keygen
LVL 20
Message Encryptor`;

const STORE = `Credits: 314
UPGRADES
CREDITS
MARKET
1,675 Crypto
UPGRADE
Bypasser
LVL 21
Breaks through a target's Firewall. Higher levels increase success rate and reduce hack time.... read more
41,877 Crypto
UPGRADE
Password Encryptor
LVL 2
Defends against password crack attempts. Higher levels increase crack time and reduce attacker success rate. Hardening:... read more
2,303 Crypto
UPGRADE
Password Cracker
LVL 21
Decrypts a target's password after bypassing their Firewall. Cracked passwords must be re-cracked if the victim... read more
57,581 Crypto
UPGRADE
Bolt II
28,000 Crypto
UPGRADE
10G Fiber+
120,000 Crypto
UPGRADE
Notepad
5,000 Crypto`;

describe("Paste: home screen", () => {
  test("reads R, LVL and XP progress, ignoring mission counters", () => {
    assert.deepEqual(parseHome(HOME), { level: 24, exp: 5870, required: 17993, reboots: 3 });
  });
  test("short forms work too", () => {
    assert.deepEqual(parseHome("20262 / 20978"), { level: null, exp: 20262, required: 20978, reboots: null });
    assert.deepEqual(parseHome("27 20262 20978"), { level: 27, exp: 20262, required: 20978, reboots: null });
    assert.equal(parseHome("LVL 27 20,262/20,978").level, 27);
  });
});

describe("Paste: Apps screen", () => {
  test("friend's apps: levels, LOCKED key prices, NOT INSTALLED = 0", () => {
    const a = parseApps(APPS_FRIEND);
    const lv = Object.fromEntries(a.levels.map((l) => [l.upgradeId, l.level]));
    assert.deepEqual(lv, { antivirus: 20, firewall: 1, password_encryptor: 1, proxy: 20, spam: 20, siphon: 17, keygen: 30, message_encryptor: 1, trace: 0 });
    assert.equal(a.keygenLevel, 30);
    assert.deepEqual(a.keys.find((k) => k.upgradeId === "proxy"), { upgradeId: "proxy", fromLevel: 20, toLevel: 44, price: 52375 });
    assert.deepEqual(a.keys.find((k) => k.upgradeId === "trace"), { upgradeId: "trace", fromLevel: 0, toLevel: 35, price: 38898 });
    assert.equal(a.keys.length, 6);
    assert.deepEqual(a.warnings, []);
  });
  test("my apps: (+3) bonus ignored, botnet from the header, no keys", () => {
    const a = parseApps(APPS_MINE);
    const lv = Object.fromEntries(a.levels.map((l) => [l.upgradeId, l.level]));
    assert.equal(lv.firewall, 21);
    assert.equal(a.levels.find((l) => l.upgradeId === "firewall")!.bonus, 3);
    assert.equal(lv.password_encryptor, 1);
    assert.equal(lv.botnet, 6); // Hive
    assert.equal(lv.siphon, 17);
    assert.equal(lv.keygen, 20);
    assert.equal(a.keys.length, 0);
  });
  test("pasting the store into the Apps box warns", () => {
    assert.ok(parseApps(STORE).warnings[0].includes("Store"));
  });
});

describe("Paste: Store", () => {
  test("reads next-level prices; descriptions mentioning Firewall don't count", () => {
    const s = parseStore(STORE);
    const got = Object.fromEntries(s.items.map((i) => [i.upgradeId, [i.toLevel, i.price]]));
    assert.deepEqual(got, {
      bypasser: [21, 41877], password_encryptor: [2, 2303], password_cracker: [21, 57581], notepad: [1, 5000]
    });
    assert.ok(!("firewall" in got));
  });
  test("pasting the Apps screen into the Store box warns", () => {
    assert.ok(parseStore(APPS_FRIEND).warnings[0].includes("Apps"));
  });
});

import { charTarget, predictedStoreXp } from "../src/domain/formulas";
describe("Formulas", () => {
  test("character XP target matches every value seen in game", () => {
    const seen: Record<number, number> = { 1: 589, 24: 17993, 25: 18975, 26: 19970, 27: 20978, 29: 23033, 30: 24079 };
    for (const [l, v] of Object.entries(seen)) assert.equal(charTarget(Number(l)), v, `LVL ${l}`);
  });
  test("Firewall store XP (likely) matches 24–26", () => {
    assert.deepEqual([24, 25, 26].map((l) => predictedStoreXp("firewall", l)!.value), [7224, 7602, 7984]);
    assert.equal(predictedStoreXp("firewall", 27)!.value, 8370);
    assert.equal(predictedStoreXp("spam", 5), null);
  });
});

import { formulaKeyPrice, formulaStorePrice } from "../src/domain/formulas";
import { SEED_OBSERVATIONS } from "../src/domain/seed";
import { buildChecklist, isDone } from "../src/domain/checklist";
import { Knowledge } from "../src/domain/knowledge";
describe("Price formulas vs every seeded real price", () => {
  test("all Keygen key prices match", () => {
    const keys = SEED_OBSERVATIONS.prices.filter((p) => p.method === "download");
    assert.ok(keys.length >= 18);
    for (const k of keys) assert.equal(formulaKeyPrice(k.upgradeId, k.fromLevel, k.toLevel), k.cost, `${k.upgradeId} ${k.fromLevel}->${k.toLevel}`);
  });
  test("all software store prices match", () => {
    const st = SEED_OBSERVATIONS.prices.filter((p) => p.method === "store" && p.priceBasis === "final" && p.costType === "per_level" && !["device", "network", "botnet"].includes(p.upgradeId));
    for (const p of st) assert.equal(formulaStorePrice(p.upgradeId, p.toLevel), p.cost, `${p.upgradeId} ${p.toLevel}`);
  });
  test("checklist: seeds tick nothing on small key jumps; a 1-level key ticks and matches", () => {
    const g = buildChecklist(SEED_OBSERVATIONS, new Knowledge(SEED_OBSERVATIONS));
    const key1 = g[0].items.find((i) => i.id === "key-1")!;
    assert.equal(isDone(key1), false);
    const one = { ...SEED_OBSERVATIONS.prices.find((p) => p.method === "download")!, id: "k1", upgradeId: "spam", fromLevel: 20, toLevel: 21, cost: formulaKeyPrice("spam", 20, 21)! };
    const obs = { ...SEED_OBSERVATIONS, prices: [...SEED_OBSERVATIONS.prices, one] };
    const item = buildChecklist(obs, new Knowledge(obs))[0].items.find((i) => i.id === "key-1")!;
    assert.equal(item.evidence[0].match, true);
  });
});
