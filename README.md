# Meridian — household dashboard

| Page | What it is |
|---|---|
| `v4.html` | **Meridian v4 (in progress).** The "Long game" design as the real dashboard: all seven tabs, with v3's own logic. It opens a workbook from this device and keeps a copy in that browser so the next visit is instant (v3 and v4 share that copy). **Your numbers** (the pencil button and the Add/Update links), the report card's homework, grade history and new-badge confetti work the same as in v3 and share its saved data. OneDrive loading is still to come, so keep using v3 for that. Add `?demo=1` to the address for made-up numbers. |
| `v3.html` | **Meridian v3.** Portfolio, report card, net worth, saving and plan views. Loads the workbook straight from OneDrive. |
| `v2.html` | Meridian v2 (upload a file each visit). |
| `index.html` | The original dashboard. |
| `previews/long-game.html` | A design preview for the next version, in the "Long game" look: all seven tabs (Pulse, Report card, Accounts, Net worth, Saving, Plan and Lab), including the Report card's what-if sandbox, comparison with people your age, net worth by age, how the grades work and a print view, with demo data, or your own workbook (use **Open workbook** or drop the file on the page; it's read in the browser, never uploaded or kept). It runs v3's own logic through `previews/kit.js`, and Appearance switches light/dark and the Harbor or Stone color. It doesn't connect to OneDrive or use the numbers saved in v3's Your numbers panel. |

Nothing personal is stored in this repository. Each page reads the workbook in the browser: from OneDrive, from a file you pick, or from a copy saved in that browser. The demo buttons use made-up numbers.

## v3: loading from OneDrive (one-time setup)

Microsoft only lets a web page read OneDrive after the page is registered as an app. The registration is free.

1. Open **entra.microsoft.com** → Applications → **App registrations** → **New registration**.
   (With a personal Microsoft account and no directory yet, Microsoft asks you to create a free one first.)
2. Name it `Meridian`. Under *Supported account types*, choose **Accounts in any organizational directory and personal Microsoft accounts**.
3. Under *Redirect URI*, pick **Single-page application (SPA)** and enter the page's exact address, for example
   `https://<your-user>.github.io/portfolio-dashboard/v3.html`. The load screen shows the exact value with a copy button.
4. Click **Register**, then copy the **Application (client) ID** from the Overview page.
5. On v3's load screen, click **Set up OneDrive**, paste the ID, then click **Save and sign in**. Pick your workbook once and v3 remembers it.

To make the ID work on every device without pasting it again, set `ONEDRIVE_CLIENT_ID` near the top of the script in `v3.html`. The ID isn't a secret.

How it works:

- The page asks for one permission: **Files.Read** (read your files).
- The workbook downloads from Microsoft directly into the browser tab. This site's server never receives it.
- Each visit shows the saved copy instantly, then checks OneDrive for a newer version. It checks again whenever you come back to the tab.
- Microsoft sometimes asks you to sign in again (for example after a browser restart). The page shows **Sign in to refresh** when that happens.

## v3: numbers the workbook doesn't have

There are two ways to add values like today's home value, take-home pay or kids' birth dates:

- **In the dashboard:** click the pencil button (**Your numbers**) or any **Update** / **Add** link. Entries are saved in that browser only and take priority over the workbook. **Copy saved numbers for your workbook** copies them as rows you can paste into cell A1 of a `Dashboard` sheet, which is how they reach your other devices.
- **In the workbook:** add a sheet named `Dashboard` with the label in column A, the value in column B and the as-of date in column C.

Recognized labels:

| Label (column A) | Value (column B) | Used for |
|---|---|---|
| `Your birth date` | date | Report card: your age (otherwise read from the Annual Forecast sheet) |
| `Home value` | today's estimate | Net worth, home equity |
| `Checking` | total balance | Net worth, emergency fund |
| `Monthly spending` | a typical month, not counting savings | Report card: emergency fund and retirement readiness (otherwise read from the Budget sheet) |
| `Mortgage balance` | balance from your statement | Replaces the calculated balance (use this if you've paid extra principal) |
| `<child> 529 balance` | balance | Kids' accounts (the first word is the child's name as used elsewhere in the workbook) |
| `<child> savings` | balance | Kids' accounts |
| `<child> birth date` | date | Kids' accounts: projection to age 18 |
| `Spouse gross pay` | yearly amount | Household savings rate |
| `Social Security` | monthly estimate (today's dollars) | Retirement income |
| `Net pay per check` | amount | Paycheck: take-home and where each check goes |
| `Guard pay` | monthly take-home | Savings rate, take-home (replaces the Budget sheet's ANG line) |

## v3: the report card

The **Report card** tab grades eight subjects from 0 to 100 and weights them into one letter grade: savings rate, retirement savings, retirement readiness, net worth, emergency fund, debt load, staying on plan, and the kids' college funds. Each subject shows the number behind it, the rule of thumb it's measured against, and what would raise it. The tab also has:

- **What if…:** sliders that re-grade the card as you drag them: save more each month, add to the 529s, change monthly spending, move money into savings, try a different market return or home value. Suggestions like "Max the 401(k)" or "Reach 6 months" set a slider for you. Nothing here is saved.
- **This week:** the week's change, how it ranks against the past year, streaks, distance from the all-time high and the target path, and the accounts that moved most.
- **You vs. households your age:** net worth, retirement accounts and savings rate against the Federal Reserve's Survey of Consumer Finances, plus a net-worth-by-age chart.
- **Badges:** the ones you've earned, and ones to look forward to with progress rings and projected dates (a $1M net worth, "Seven figures before 40", "Work optional", mortgage halfway, college fully funded, saving streaks and more). A new badge gets confetti the first time you see it.
- **The road ahead:** a dated timeline of what's coming: net worth and portfolio milestones, the kids turning 18, the mortgage, retirement, the Guard pension and Social Security.
- **Next best moves and homework** (protection the workbook can't see, like wills and insurance). Homework ticks, each week's grades and the badges you've seen are saved in that browser only.
- **Print or save as PDF.**

The benchmarks are public figures kept in `BENCH` near the top of the script in `v3.html`, each with its source. Update them when new editions come out; the Fed's 2025 Survey of Consumer Finances results are due in late 2026.

## Libraries

`vendor/` holds pinned copies of SheetJS 0.18.5 (mini build), Apache ECharts 5.6.0 and MSAL Browser 4.30.0, and `vendor/fonts/` holds the Fraunces and Figtree typefaces (SIL Open Font License). The licenses are in `vendor/licenses/`. They're served from this site rather than a CDN, so nothing third-party loads on a page that holds a OneDrive sign-in.

At the start of each year, add the new IRS 401(k) limit to `IRS_401K_LIMITS` in `v3.html`.
