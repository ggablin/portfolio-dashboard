# Meridian: hand-off notes for agents

Meridian is a private household-finance dashboard for one family. It reads the owner's Excel workbook in the browser and turns it into charts, projections and a report card. It's a static site: one HTML page, no build step, no server.

_Last updated 30 September 2026, after PR #8. Safe to publish: this file contains no personal data._

## At a glance

| | |
|---|---|
| **Repository** | https://github.com/ggablin/portfolio-dashboard (**public**). Default branch `main` |
| **Live site** | https://ggablin.github.io/portfolio-dashboard/v3.html (GitHub Pages, deployed from `main`) |
| **Current version** | `v3.html` ("Meridian v3"), about 7,800 lines of HTML, CSS and JavaScript in one file |
| **Older pages** | `index.html` (the original; the root URL serves it) and `v2.html`. Both are still live, so don't break them |
| **Data** | The owner's workbook, `greg_numbers.xlsx`. The page reads it in the browser from OneDrive, a local file or a copy saved in that browser |
| **Libraries** | ECharts 5.6.0, SheetJS 0.18.5 (mini) and MSAL Browser 4.30.0, plus the Fraunces and Figtree fonts. All are copied into `vendor/`, with licenses in `vendor/licenses/` |
| **Tooling** | None. No package.json, no bundler, and no tests or CI in the repo. GitHub Pages deploys `main` automatically |
| **Owner** | GitHub user `ggablin`. Agents open PRs when asked, and the owner reviews and merges them |

**Start here:** read `README.md` (setup and user-facing features), then this file. Serve the repo locally (see [Testing](#testing)), open `v3.html` and click **Demo** to see every tab with made-up numbers.

## Ground rules

1. **The repo and the site are public.** Never commit personal data. That includes names of family members, pay, balances, account numbers, birth dates, the workbook or anything taken from it, and screenshots or test fixtures made from real data. Git history keeps everything, even after a delete. Before every commit, grep your diff for any name or figure you've seen in the workbook or in chat.
   - The owner sometimes shares real numbers in chat. Those go in the dashboard's **Your numbers** panel or the workbook's `Dashboard` sheet, never in code.
   - Use made-up examples in comments, docs and demo data, like "Sam 529 balance" rather than a real child's name.
2. **Never touch rows 25–37 of the Mortgage Calc sheet.** They hold third-party data that isn't the household's. Don't read, parse, show, log or quote them. `mortgageTerms()` scans only rows 1–23 on purpose, so keep it that way.
3. **No third-party requests while the page runs.** The page can hold a Microsoft sign-in, so every script, font and image is served from `vendor/`. The only outside calls are Microsoft sign-in (`login.microsoftonline.com`) and Microsoft Graph (`graph.microsoft.com`, plus the download link Graph returns). Don't add CDNs, Google Fonts, analytics or data APIs.
   - For example, the home value isn't pulled live from Zillow. There's no free API, scraping breaks their terms, and an API key would be public.
4. **Keep it one file, in plain JavaScript with no build step.** The logic modules (`Parse`, `Compute`, `Household`, `Report`) take data and return plain objects without touching the page. Drawing happens in `Views`.
5. **Work on a branch and open a PR against `main`. Never push to `main`.** After the owner merges, GitHub Pages redeploys in about a minute (the "pages build and deployment" run in Actions).
   - Pages builds with Jekyll and there's no `.nojekyll` file, so don't start a file or folder name with `_`.
6. **Write plainly** in the interface, in PR descriptions and in replies to the owner. Use short sentences, everyday words and sentence case.

## Where the data comes from

### The workbook

The owner keeps `greg_numbers.xlsx` in OneDrive and adds balances to it each week. `Parse.workbook()` turns it into one data object, called `d` throughout the code.

- **Only Weekly Balances is required.** Every other sheet is optional.
- **A failed sheet doesn't break the page.** It logs a console warning, and that part of the dashboard shows an empty state or an **Add** link.
- **Labels are found by searching** (`find()`) rather than at fixed cells wherever possible. That lets the owner move things around a little, so keep it that way.

| Sheet | What's in it | Parser → field on `d` |
|---|---|---|
| **Weekly Balances** (required) | One row per week, starting at row 8: the date in A, account balances in B–K (savings, stocks, ups, utma, inheritance, ira, tsp, k401, b403, crypto), the total in M. A projections block in rows 2–3 holds the rate of return, the monthly contribution and a `DATEDIF` formula containing the retirement date. Notes are in W; a weekly target path is in Y–Z | `weeklyBalances` → `rows`; `projection`, `targetPath`, `sheetNotes` |
| **Sheet1** | This year's growth by account: beginning balance, contributions, dividends, fees, growth and ending balance. Totals are on row 13 | `attribution` → `attr` |
| **Amortization** | The year-by-year plan (estimated vs. actual) and each year's per-paycheck 401(k) block | `amortPlan` → `plan`; `k401Blocks` → `k401` |
| **Annual Forecast** | An older long-range forecast. It's also the fallback source for the owner's age | `forecast` → `forecast` |
| **Pension & SS** | Guard retirement points and monthly retirement pay. Despite the name, it has no Social Security figures | `pension` → `pension` |
| **Average Savings** | Contributions by account by month, one block per year. A repeated year label is read as the following year | `contributions` → `contrib` |
| **Sheet5** | The account list: accounts, debts, the kids' 529 and UTMA plans, and opened dates. It's found by its content (a "Liabilities" label), not its name. It's an old snapshot, so Dashboard values override it | `accountSheet` → `accounts` |
| **Mortgage Calc** | Loan terms: price, down payment, rate, term, taxes and insurance. **Rows 1–23 only** | `mortgageTerms` → `mortgage` |
| **Budget** | Only a few lines are used: Guard ("ANG") pay, the mortgage payment, gross pay and paycheck changes, expenses, net income and the 529 lines | `budget` → `budget` |
| **Dashboard** (optional) | Rows of label, value and as-of date for things the workbook doesn't track elsewhere. The README lists the recognized labels | `inputs` → `inputs` |
| Not read | Claude Log; Charts & Insights (it repeats other sheets and counts contributions as returns); Dis (a savings-goals list) | — |

**Known quirks in the workbook** (as of September 2026; the owner fixes these on their side):
- **No weekly data from April 2022 to January 2023.** `markGaps()` keeps that stretch from counting as one giant week.
- **The account list dates from January 2024.**
- **A few cells show `#REF!` errors.**

### How the workbook reaches the page

This is the order `boot()` runs in, at the end of the script:

1. **Finish a Microsoft sign-in redirect,** if one is in progress.
2. **Show the saved copy right away.** The last workbook's bytes are kept in IndexedDB (database `meridian`, store `files`, key `workbook`). The **Keep a copy on this device so it opens instantly** checkbox on the load screen turns this off.
3. **Check OneDrive for a newer version.** It checks again whenever the tab comes back into focus.
   - Sign-in uses MSAL's redirect flow with one permission, `Files.Read`, and tenant `common`.
   - Graph's `/me/drive/root/search(q=…)` finds the file; the search text defaults to `greg_numbers`. Then `/me/drive/items/{id}` fetches it.
   - The file goes straight from Microsoft to the browser. GitHub's servers never see it.
4. **Or open a file by hand** by dragging it onto the page or using the file picker.
5. **Or use the demo.** The **Demo** and **Sparse demo** buttons load made-up data from `Demo.build()`, which uses a fixed seed and returns the same shape as `Parse`. Use these for screenshots and tests.

**OneDrive setup** is covered in the README.
- `ONEDRIVE_CLIENT_ID` in `v3.html` is empty. The owner pastes the ID on the load screen, and it's saved in that browser.
- The ID isn't a secret, so it can go in the code if the owner wants every device set up automatically.
- **No agent has tested a real Microsoft sign-in**, only a simulated one. It's also unknown whether the owner has finished the app registration, so ask before assuming.

### Numbers the workbook doesn't have

The **Your numbers** panel saves values like the home value, birth dates, take-home pay and Guard pay in that browser. It opens from the pencil button or any **Update** or **Add** link.
- These values take priority over the Dashboard sheet's rows (`Manual.apply()`).
- **Copy saved numbers for your workbook** exports them as rows for the Dashboard sheet. That's how they reach the owner's other devices.
- Each kid is matched on the first word of a label (`kidKey()` uses its first three letters, lowercased).

### What's saved in the browser

Everything here stays in that one browser and is never sent anywhere.

| Where | Key | Holds |
|---|---|---|
| IndexedDB | `meridian` → `files` → `workbook` | The last workbook's bytes and details |
| localStorage | `mer3-od-config` | The OneDrive client ID and tenant |
| | `mer3-od-item`, `mer3-od-query` | The chosen OneDrive file, and the search text |
| | `mer3-keep` | Whether to keep a saved copy (on by default) |
| | `mer3-inputs` | Your numbers |
| | `mer3-rc-history` | Each week's report card grades |
| | `mer3-rc-homework` | Homework checkboxes |
| | `mer3-rc-seen` | Badges already celebrated, so confetti fires once per badge |
| | `pp2-theme` | Light or dark (shared with v2) |
| | MSAL's own keys | The Microsoft sign-in cache |

## Code map (`v3.html`)

Search by name; line numbers change often.

- **Markup and CSS (roughly the first 1,600 lines).** Design tokens are in `:root`, with the dark theme under `:root[data-theme="dark"]`. Then come the load screen, the top bar, seven `<section class="view" id="view-…">` blocks, the Your numbers dialog and the toast.
- **Constants:**
  - `GROUPS` and `ACCOUNTS`: the account model.
  - `IRS_401K_LIMITS`: yearly 401(k) limits.
  - `BENCH`: published benchmarks, each with its source.
  - `ONEDRIVE_CLIENT_ID`: empty by default (see above).
  - `CONTRIB_GROUPS`: where contributions go.
  - `THEMES`: chart colors that mirror the CSS tokens. Keep the two in sync.
- **Logic modules.** None of these touch the page.
  - `Parse`: workbook → `d`.
  - `Demo`: a made-up `d`.
  - `Compute`: stats on the weekly rows: returns, drawdowns, milestones, the retirement projection, FIRE, the week and month grids, and the year table.
  - `Household`: the logic behind the v3 views.
    - The plan rate, the target path and plan history.
    - The mortgage schedule (`mortBalanceAt`) and debts.
    - Contributions, the paycheck and the savings rate.
    - **401(k) + TSP pacing** (`k401Year`, `tspYear`).
    - The kids' 529 projections and the net worth series.
    - Results are cached per `d`, so call `Household.invalidate(d)` after inputs change.
  - `Report`: the report card.
    - `card(d, adj)` grades 8 subjects from 0 to 100 (using `curve()`) and turns each into a letter. `facts(d, adj)` applies the What if… changes.
    - `peers` compares against the Fed's Survey of Consumer Finances.
    - `outlook` projects month by month at the lower of the plan rate and 7%, plus current contributions.
    - Also `week`, `badges`, `roadAhead`, `moves` and `homework`.
- **Charts.** `Charts` manages the ECharts instances. `baseOption`, `tip`, `timeAxis` and `valAxis` set the shared chart style. `Tables` gives every chart a table view.
- **`Views`:** one render function per tab (`Views.pulse`, `Views.report` and so on).
- **The rest:**
  - `Calcs`: calculator inputs.
  - `Prefs`: localStorage.
  - `Store`: IndexedDB.
  - `OneDrive`: MSAL and Graph.
  - `Sources`: the load screen, the data-source pill and refresh.
  - `Manual`: Your numbers.
  - The main section at the end: `switchView`, `loadData`, the theme toggle and `boot()`.

### Tabs

| Tab | What's on it |
|---|---|
| **Pulse** | Portfolio over time (with the target path and the sheet's notes), weekly change, drawdown from peak, milestones, and week-by-week, month-by-month and year-by-year tables |
| **Report card** | The overall grade and subjects, What if…, This week, You vs. people your age, net worth by age, badges (earned and up next), The road ahead, next best moves, homework, how the grades work, and printing |
| **Accounts** | Allocation and drift, composition over time, every account with its detail, where this year's growth came from, and the kids' accounts |
| **Net worth** | Balance sheet, debts, net worth over time, mortgage and home equity, and "Pay extra, or invest it?" |
| **Saving** | Contributions by month, where this year's savings went, savings rate, saved vs. market growth, and paycheck |
| **Plan** | Retirement projector, retirement income, pension points, plan history, and 401(k) contribution pacing |
| **Lab** | Contribution what-if, milestone ETA and FIRE explorer |

The 1Y / 3Y / 5Y / YTD / All range buttons apply to Pulse, Accounts and Net worth.

### How the report card grades

| Subject | Weight |
|---|---|
| Savings rate | 20 |
| Retirement savings | 15 |
| Retirement readiness | 15 |
| Net worth | 15 |
| Emergency fund | 10 |
| Debt load | 10 |
| On plan | 10 |
| Kids' college | 5 |

- **Missing data skips a subject** rather than failing it. The overall grade needs at least three graded subjects.
- **Benchmarks and their sources** are in `BENCH`. The "How the grades work" card on the tab explains each rule of thumb.

## Design system

- **The look:** a navigator's chart. A warm paper light theme and a deep navy dark theme, a faint grid, Fraunces for headings and big numbers, and Figtree for everything else.
- **Tab colors:** each tab has its own flag color (`--f-pulse`, `--f-report` and so on), picked through `[data-view]` on `<body>`. `--tab` fades between them using `@property`.
- **Chart colors:**
  - Each account or group keeps its color everywhere (`GROUPS`, `CONTRIB_GROUPS`); color never depends on rank.
  - The palettes were checked for color blindness and contrast against both card backgrounds (`#fffdf7` light, `#0e1b2e` dark). Check again if you change either.
- **Chart rules:**
  - Never two y-axes on one chart.
  - Every chart has a table view and a hover tooltip.
  - Labels and values use the text colors, not the series colors.
- **Motion:** respect reduced-motion settings through the `MOTION` constant. The confetti and the counting-up numbers already do.
- **Where to check layouts:** 390px wide (phone), both themes, and print (the report card has a print view).

## Testing

There are no tests in the repo. Agents have tested with Playwright and Chromium against a local server:

```bash
# from the repo root
python3 -m http.server 8765 --bind 127.0.0.1 &
node smoke.js                                               # NODE_PATH=$(npm root -g) if Playwright is installed globally
WORKBOOK=/path/outside/the/repo/greg_numbers.xlsx node smoke.js   # optional: only if the owner shares the file
```

`smoke.js` opens every tab in light and dark, at desktop and phone widths, with both demo data sets. It adds the real workbook if `WORKBOOK` is set. It fails on any console error or warning and takes about 40 seconds.

```js
// smoke.js: every tab, light + dark, desktop + phone, demo + sparse demo (+ a real workbook if WORKBOOK is set).
// Fails on any console error/warning or uncaught exception.
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:8765/v3.html';
const TABS = ['pulse', 'report', 'accounts', 'networth', 'saving', 'plan', 'lab'];
(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const sources = [['demo', p => p.click('#demoBtn')], ['sparse', p => p.click('#demoSparseBtn')]];
  if (process.env.WORKBOOK) sources.push(['workbook', p => p.setInputFiles('#fileInput', process.env.WORKBOOK)]);
  for (const [name, load] of sources)
  for (const viewport of [{width: 1280, height: 900}, {width: 390, height: 844}])
  for (const theme of ['light', 'dark']){
    const label = `${name} ${viewport.width}px ${theme}`;
    const ctx = await browser.newContext({viewport});
    await ctx.addInitScript(t => localStorage.setItem('pp2-theme', t), theme);
    const page = await ctx.newPage();
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push(`[${label}] ${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => problems.push(`[${label}] ${e.message}`));
    await page.goto(URL);
    await load(page);
    await page.waitForSelector('#appView:not([hidden])');
    for (const v of TABS){
      await page.click(`#tabs .tab[data-view="${v}"]`);
      await page.waitForTimeout(400);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(problems.length ? problems.join('\n') : 'OK: no console errors');
  process.exit(problems.length ? 1 : 0);
})();
```

Other checks worth doing, depending on the change:

- **Screenshots** of the tabs you changed, at desktop and phone widths, in both themes.
- **Print:** `page.emulateMedia({media: 'print'})` on the report card.
- **Logic:** call the logic modules directly, for example `page.evaluate(() => Report.card(state.data).overall)`.
- **OneDrive:** simulate Microsoft in the test.
  - Route `**/vendor/msal-browser-4.30.0.min.js` to a fake `msal` object: a `PublicClientApplication` with `initialize`, `handleRedirectPromise`, `getAllAccounts`, `acquireTokenSilent` and `loginRedirect`.
  - Route `https://graph.microsoft.com/**` to canned JSON for the search, the item details and a download link.

## Domain notes

- **The 401(k) limit is per person across all plans.** The IRS limit ($24,500 in 2026) covers the civilian 401(k) and the Guard TSP together, whether Roth or traditional, so the pacing card and the report card add them up.
  - The IRA limit is separate.
  - IRA balances are tracked, but IRA contribution limits and age-50 catch-up contributions aren't modeled.
- **Pay periods:** civilian pay is every two weeks (26 a year). Guard pay ("ANG" in the Budget sheet) is monthly.
- **Retirement income:**
  - The Guard pension starts at 60, and points convert to monthly pay (see Pension & SS).
  - Social Security starts at 67. The amount comes only from the owner's entry, in Your numbers or the Dashboard sheet.
  - The spouse's pension isn't included yet.
- **Projections** use the workbook's plan rate, from the projections block. Report card forecasts cap it at 7%. Projected dates on badges ("Around Dec 2030") and on The road ahead are estimates, not promises.
- **The mortgage balance** is worked out from the Mortgage Calc loan terms. If the owner enters a balance from a statement, that's used instead, which covers any extra principal paid.
- **The owner's age** comes from `Your birth date`, or from the Annual Forecast sheet if that's missing.
- **Yearly upkeep:**
  - Each January, add the new IRS limit to `IRS_401K_LIMITS`. The IRS announces it in the fall.
  - The Fed's 2025 Survey of Consumer Finances is due in late 2026 (it comes out every three years). Update `BENCH.scf` then.
  - Refresh the other `BENCH` entries as new editions come out. Each one lists its year and source.

## History

| PR | Merged | What |
|---|---|---|
| #1 | 2026-05-16 | Redesign of the original dashboard: dark mode and mobile navigation |
| #2 | 2026-05-16 | Renamed it to `index.html` so the root URL serves it |
| #3 | 2026-05-30 | Accessibility and contrast fixes |
| #4 | 2026-07-11 | Meridian v2 (`v2.html`) |
| #5 | 2026-09-26 | Meridian v3: OneDrive loading, and the net worth, saving, plan and kids' account views |
| #6 | 2026-09-26 | The Your numbers panel |
| #7 | 2026-09-27 | The report card, age-group comparisons and What if… sliders |
| #8 | 2026-09-28 | The navigator's chart design, badges to look forward to, The road ahead, and 401(k) pacing that counts the TSP |

## Open items and ideas

None of these have been started. Check with the owner before building any of them.

- **OneDrive:** confirm the owner's app registration works with a real sign-in. If the owner wants, put the client ID in `ONEDRIVE_CLIENT_ID`.
- **A cash flow view** from the Budget sheet: spending by category, month by month, and the budget's scenarios.
- **A holdings view** from the account list: the funds and stocks held across accounts, and total stock vs. cash exposure.
- **A goals tracker** from the Dis sheet.
- **The spouse's pension** in retirement income.
- **Fund expense ratios** and what fees cost each year.
- **A `tests/` folder** holding `smoke.js`, so the next agent doesn't have to rebuild it.
