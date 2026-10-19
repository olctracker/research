# HEDB · Hack EX2 Upgrade Database

A phone-friendly web app for recording Hack EX2 upgrade purchases, working out the EXP each one gave, and building a shared database of real price and EXP observations.

**Phase 1 (this version):** setup at any game state · dashboard · purchase flow (store and download) · EXP worked out from your before/after character screen · missing-data prompts · purchase history · shared research database with conflict tracking and flags · coverage chart · manual observation entry · CSV/JSON export.

**Later phases:** formula discovery, cheapest-path optimizer, and reboot planning. Reboot planning stays off until the rules are verified.

**Menu (left side):**
- **My Device:** your LVL, XP and every software level. Edit it anytime, for example if a purchase wasn't tracked.
- **Store Prices** / **Keygen Prices:** the price of each program's **next** level, which is all the game shows. The menu count is how many you can see in game that nobody has entered yet.
- **Purchase:** pick the software, choose Store or Keygen, check the price, and confirm your LVL and XP. Your device then updates. If the XP reward is known, it's added automatically, levelling you up with the leftover carried over. If not, you enter your stats after buying and the app works it out.
- **History**
- **Data Table:** pick a program (or Character levels) to see every level's store and Keygen price and XP, so you know exactly what's missing.
- **Coverage & Conflicts**
- **Settings**

---

## How it fits together

```
src/domain/   Pure game logic, no UI or database (catalog, EXP maths, purchase planning, coverage)
src/data/     Storage: LocalRepository (this browser) or SupabaseRepository (shared)
src/screens/  The app pages: Setup, Dashboard, Buy, History, Research, Settings
src/ui/       Small shared components and the hash router
supabase/migrations/  SQL to create tables, validation and security rules
tests/        Acceptance tests (npm test) and database security tests (tests/sql)
```

**Accounts:** every player creates a **username + 4-digit PIN**. Their progress follows them to any phone. One admin (you) settles conflicting reports and can reset forgotten PINs.

Without Supabase settings the app runs in **test mode**: accounts and data are saved only in that browser, and the first account created is the admin. Add the two settings below to switch to the shared database.

---

## Setup (do these once)

### 1. Supabase (the shared database)

1. Go to [supabase.com](https://supabase.com) and create a **new project**. Pick any name and save the database password somewhere safe.
2. Open **SQL Editor → New query**. Paste all of `supabase/setup.sql` and click **Run**. It is `0001_schema.sql` + `0002_seed.sql` in one file and is safe to run again.
   - Already ran an older `setup.sql` from before account approval? Run only `supabase/migrations/0003_admin_tools_upgrade.sql` instead. It's short and safe to repeat.
3. (Nothing else to run — the starting data is included.)
4. Set up PIN accounts. Go to **Authentication → Sign In / Providers → Email** and set:
   - **Enable Email provider**: on
   - **Confirm email**: **off**. This is required, because players sign up with a username and PIN, not a real email address.
   - Save.

   Behind the scenes the app turns `username` + PIN into the account `username@users.hedb.app`. No real email is ever used or stored.
5. Copy two values from **Project Settings → API Keys** (the Project URL is under **Data API** or on the project home page):
   - **Project URL**, like `https://abcdxyz.supabase.co`
   - **Publishable key**, starting with `sb_publishable_`. Older projects call it the `anon` key.

   ⚠️ **Never** use the **secret** or **service_role** key anywhere in this project. The app refuses to start if one is configured.

### 2. GitHub Pages (the website)

1. In the GitHub repository go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. Put the Supabase **Project URL** and **publishable key** in `.env.production` (already done for HEDB). Both are public by design; Row Level Security protects the data.
3. Open the **Actions** tab, pick **Deploy to GitHub Pages**, and click **Run workflow**. Every later push to `main` redeploys automatically.
4. The site appears at `https://<your-github-name>.github.io/<repository-name>/`.

### 3. Make yourself the admin

1. Open the site and **Create account** with your username and PIN.
2. In Supabase **SQL Editor** run this, replacing `your_username`:
   ```sql
   insert into public.app_admins (user_id)
   select user_id from public.player_profiles where username = 'your_username';
   update public.player_profiles set approved = true where username = 'your_username';
   ```
3. Sign out and back in. You'll see **ADMIN** next to your name.

As admin you get:
- **Conflicts:** when players report different values (for example, two different prices for Spam level 6), the dashboard alerts you. **Research → Conflicts** shows each value, who entered it, when, and whether it came from a recorded purchase. Tap **Use …** to choose the right one. The others are marked *rejected*, but they're never deleted.
- **Records:** mark any single observation confirmed or rejected, and resolve flags.
- **Settings → Players:** approve or reject new sign-ups (new accounts can't see or add data until approved), rename players (their PIN stays the same; works for your own account too, and you stay admin), reset forgotten PINs, and delete accounts (their shared reports stay on record).

### 4. Install on phones

- **Android (Chrome):** open the site, then tap **Install app** (on More, or the sign-in screen), or use menu ⋮ → **Add to Home screen**.
- **iPhone (Safari):** open the site, then tap Share → **Add to Home Screen**. iPhone only allows this from Safari.

The installed app opens full-screen with its own icon.

---

## Running it on a computer (optional)

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
cp .env.example .env.local   # optional: fill in the two Supabase values
npm run dev                  # opens a local dev server
npm test                     # runs the acceptance tests
npm run build                # type-checks and builds into dist/
```

---

## Security summary

- The frontend only ever has the **publishable** key.
- Sign-in uses Supabase Auth. PINs are never stored by the app; Supabase stores only a salted hash.
- **A 4-digit PIN has only 10,000 combinations.** That's fine for a game tracker, but not for anything that matters. After 5 wrong PINs the app locks that username for 15 minutes, and Supabase Auth's own sign-in rate limits add a second layer. A determined attacker who skips the app and calls Supabase directly is limited only by those rate limits. Tell players not to reuse a bank or phone PIN.
- Only signed-in players can read the research data. Contributor names come from the account and are stamped by the database, so nobody can post under someone else's name.
- Every table has **Row Level Security** turned on:
  - Your progress, levels and purchase history are visible and editable **only by you**.
  - Anyone can read shared observations. Signed-in players can add new ones, but only with status `observed` and only under their own ID.
  - Nobody can edit or delete raw observations through the app. Only admins can change an observation's status. Flags are added alongside a record; they never change it.
- The database itself checks input too: methods allowed per upgrade, level caps, one-time items, number ranges, and note length.
- `tests/sql/10_rls_test.sql` proves these rules, and it runs in GitHub Actions whenever the SQL changes.
- No game passwords or personal details are stored. The alias is optional.

---

## How the numbers work

- **Store:** one level at a time. Total cost and EXP are the sums of each level's observed values.
- **Keygen (download):** recorded one level at a time (the next level's price). Multi-level jumps aren't supported yet.
- **Download data model:** one transaction. Cost is the observed combined total. If only per-level download *components* are known, their sum is shown, clearly labelled as an estimate. EXP counts the destination level only.
- **Keygen:** a download to level N needs Keygen N or higher (working rule, still being verified).
- **Defensive discount (15%):** applies to Firewall, Password Encryptor, Antivirus, Proxy and Trace store purchases. Prices are stored as the final amount charged, and the rounding rule is still being researched.
- **Character EXP:** worked out level by level using each level's own requirement, with carry-over. If any requirement in between is unknown, the result is shown as "at least X", never as a made-up exact number.
- **Reliability** of each value: Unknown → Observed once → Repeated observation → Confirmed (admin only). Disagreeing observations are all kept and shown as a **conflict**. They are never averaged.

---

## Known limitations and unverified mechanics

- **Unverified:** the Keygen download rule, the discount rounding, whether download totals equal the sum of their components, and caps on uncapped software.
- **Spec Example B is not in the database:** the download cost components 100/200/300/400 with 5 EXP weren't saved because the software they came from wasn't recorded. Record it again with the software name.
- **EXP inference assumes nothing else gave EXP** between "before" and "after". Enter your new stats right after buying. Use **Home → Update** for EXP from hacks and other sources.
- **Coverage measures a defined range:** capped upgrades up to their maximum; uncapped software up to level 20, or the highest level anyone has recorded; character levels 1–30. 100% coverage there does not mean everything is known.
- **Deleting a history entry** doesn't roll back your levels. Use **Edit game state** for that.
- **Moderation is basic:** admins mark records confirmed or rejected and resolve flags. There's no voting or bulk review yet.
- The site has a `noindex` tag so search engines skip it. Anyone with the link can open the sign-in page, but research data needs an account.
- Offline: the installed app opens without a connection, but needs internet to sign in, load or save data.
