# Hack EX2 Upgrade Tracker

A phone-friendly web app for recording Hack EX2 upgrade purchases, working out the EXP each one gave, and building a shared database of real price and EXP observations.

**Phase 1 (this version):** setup at any game state · dashboard · purchase flow (store and download) · EXP worked out from your before/after character screen · missing-data prompts · purchase history · shared research database with conflict tracking and flags · coverage chart · manual observation entry · CSV/JSON export.

**Later phases:** formula discovery, cheapest-path optimizer, and reboot planning. Reboot planning stays off until the rules are verified.

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

Without Supabase settings the app runs in **local mode**: everything is saved in your browser and nothing is shared. Add the two settings below to switch to the shared database.

---

## Setup (do these once)

### 1. Supabase (the shared database)

1. Go to [supabase.com](https://supabase.com) and create a **new project**. Pick any name and save the database password somewhere safe.
2. Open **SQL Editor → New query**. Paste all of `supabase/migrations/0001_schema.sql` and click **Run**.
3. Do the same with `supabase/migrations/0002_seed.sql`. This adds the 16 upgrades and the Spam example data.
4. Turn on anonymous accounts: **Authentication → Sign In / Providers → "Allow anonymous sign-ins" → on → Save**.
   Players don't need email or passwords. Each phone gets its own private profile.
5. Copy two values from **Project Settings → API Keys** (the Project URL is under **Data API** or on the project home page):
   - **Project URL**, like `https://abcdxyz.supabase.co`
   - **Publishable key**, starting with `sb_publishable_`. Older projects call it the `anon` key.

   ⚠️ **Never** use the **secret** or **service_role** key anywhere in this project. The app refuses to start if one is configured.

### 2. GitHub Pages (the website)

1. In the GitHub repository go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. Go to **Settings → Secrets and variables → Actions → Variables tab → New repository variable** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key

   These go under *Variables*, not *Secrets*, because both values are public by design. Row Level Security protects the data.
3. Open the **Actions** tab, pick **Deploy to GitHub Pages**, and click **Run workflow**. Every later push to `main` redeploys automatically.
4. The site appears at `https://<your-github-name>.github.io/<repository-name>/`.

### 3. Make yourself the admin (optional, for moderation)

1. Open the site on your phone once, then open **More → Account** and note the start of the Player ID.
2. In Supabase open **Authentication → Users** and find the anonymous user with that ID. Copy its full ID.
3. In **SQL Editor** run:
   ```sql
   insert into public.app_admins (user_id) values ('paste-the-full-id-here');
   ```
4. Reload the app. On **Research → Records** you can now mark observations confirmed or rejected and resolve flags.

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
- **Download:** one transaction. Cost is the observed combined total. If only per-level download *components* are known, their sum is shown, clearly labelled as an estimate. EXP counts the destination level only.
- **Keygen:** a download to level N needs Keygen N or higher (working rule, still being verified).
- **Defensive discount (15%):** applies to Firewall, Password Encryptor, Antivirus, Proxy and Trace store purchases. Prices are stored as the final amount charged, and the rounding rule is still being researched.
- **Character EXP:** worked out level by level using each level's own requirement, with carry-over. If any requirement in between is unknown, the result is shown as "at least X", never as a made-up exact number.
- **Reliability** of each value: Unknown → Observed once → Repeated observation → Confirmed (admin only). Disagreeing observations are all kept and shown as a **conflict**. They are never averaged.

---

## Known limitations and unverified mechanics

- **Unverified:** the Keygen download rule, the discount rounding, whether download totals equal the sum of their components, and caps on uncapped software.
- **Spec Example B is not in the database:** the download cost components 100/200/300/400 with 5 EXP weren't saved because the software they came from wasn't recorded. Record it again with the software name.
- **EXP inference assumes nothing else gave EXP** between "before" and "after". Enter your new stats right after buying. Use **Home → Update** for EXP from hacks and other sources.
- **Anonymous sessions are per browser.** Clearing site data, or switching phone or browser, starts a new empty profile, so export a backup now and then. Linking an email account is planned for Phase 2.
- **Coverage measures a defined range:** capped upgrades up to their maximum; uncapped software up to level 20, or the highest level anyone has recorded; character levels 1–30. 100% coverage there does not mean everything is known.
- **Deleting a history entry** doesn't roll back your levels. Use **Edit game state** for that.
- **Moderation is basic:** admins mark records confirmed or rejected and resolve flags. There's no voting or bulk review yet.
- The site has a `noindex` tag so search engines skip it. Anyone with the link can still open it.
