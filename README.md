# Meridian — household dashboard

| Page | What it is |
|---|---|
| `v3.html` | **Meridian v3.** Portfolio, net worth, saving and plan views. Loads the workbook straight from OneDrive. |
| `v2.html` | Meridian v2 (upload a file each visit). |
| `index.html` | The original dashboard. |

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
| `Home value` | today's estimate | Net worth, home equity |
| `Checking` | total balance | Net worth |
| `Mortgage balance` | balance from your statement | Replaces the calculated balance (use this if you've paid extra principal) |
| `<child> 529 balance` | balance | Kids' accounts (the first word is the child's name as used elsewhere in the workbook) |
| `<child> savings` | balance | Kids' accounts |
| `<child> birth date` | date | Kids' accounts: projection to age 18 |
| `Spouse gross pay` | yearly amount | Household savings rate |
| `Social Security` | monthly estimate (today's dollars) | Retirement income |
| `Net pay per check` | amount | Paycheck: take-home and where each check goes |
| `Guard pay` | monthly take-home | Savings rate, take-home (replaces the Budget sheet's ANG line) |

## Libraries

`vendor/` holds pinned copies of SheetJS 0.18.5 (mini build), Apache ECharts 5.6.0 and MSAL Browser 4.30.0. The licenses are in `vendor/licenses/`. They're served from this site rather than a CDN, so no third-party script runs on a page that holds a OneDrive sign-in.

At the start of each year, add the new IRS 401(k) limit to `IRS_401K_LIMITS` in `v3.html`.
