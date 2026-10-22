// The shareable formula sheet (plain text, so it pastes cleanly into Discord, texts or notes).
import { BASE_PRICE } from "./formulas";

const n = (v: number) => v.toLocaleString("en-US");
const base = (id: string) => n(BASE_PRICE[id]);

export const FORMULA_SHEET = `HACK EX2 FORMULAS (verified with real game data)

STORE PRICES (apps)
• Price for level L = base × L^1.3, rounded up
• Defensive apps (Firewall, Password Encryptor, Antivirus, Proxy, Trace): then × 0.85, rounded up
• Base prices: Spam ${base("spam")} · Siphon ${base("siphon")} · Rootkit ${base("rootkit")} · Password Cracker ${base("password_cracker")} · Password Encryptor ${base("password_encryptor")} · Antivirus ${base("antivirus")} · Proxy ${base("proxy")} · Trace ${base("trace")} · Firewall ${base("firewall")} · Bypasser ${base("bypasser")} · Keygen ${base("keygen")}

HARDWARE & ONE-TIME PRICES (fixed)
• Device Lv 2–12: 4k, 10k, 18k, 28k, 40k, 56k, 82k, 120k, 160k, 220k, 300k
• Network Lv 2–11: 3k, 7k, 12k, 20k, 30k, 44k, 60k, 85k, 120k, 170k
• Botnet: Node 800 · Cluster 3,500 · Grid 15,000 · Farm 42,000 · Hive 95,000 · Nexus 180,000
• Notepad 5,000 · Message Encryptor 9,000

KEYGEN KEY PRICES
• Key from level A to B = store price of level B × 0.5 × (0.3 + 0.7 × (B − A − 1) ÷ 19), rounded up
• That last part maxes out at 1, so: 1-level jump = 15% of the store price, 20+ levels = 50%
• You need Keygen level B or higher. Your Keygen level doesn't change the price.

UPGRADE XP
• XP for reaching level L = 20% of (base × L^1.25 rounded up, then × 0.85 rounded up for defensive apps), rounded down
• A key only gives the XP of the level it lands on. Skipped levels give no XP.
• Device = 25% of its price · Network = 20% of its price · Botnet ≈ price ÷ 6 · Notepad = 1,000

CHARACTER LEVELS
• XP needed at LVL L (the number after the "/") = 230 × (L + 1)^1.3544, rounded up
• LVL 1 = 589. Leftover XP carries over when you level up. Reboots don't change it.

TIPS
• Cheapest XP: keys one level at a time (about 1 XP per Crypto vs about 0.2 in the store)
• Big key jumps: cheapest way to raise an app's level, but you lose the skipped levels' XP

From HEDB (Hack EX2 Upgrade Database)`;
