# InnovateHer Sponsorship Outreach Automation

Google Apps Script project (managed locally with [clasp](https://github.com/google/clasp))
that automates sponsor outreach for the InnovateHer hackathon finance team.

## What it does

1. Reads the outreach master list (a Sheet in the InnovateHer Drive, across its 5 sponsor category tabs) to find sponsors not yet contacted, skipping anyone whose contact email is already logged as contacted anywhere else in the sheet.
2. Uses the Apollo.io API to find contacts at those sponsor organizations.
3. Finds additional sponsor contacts outside the master list that fit a target category.
4. Uses the sponsorship outreach guide + final email template (Docs in Drive) to draft a personalized email.
5. Emails the drafted message to the sponsor row's "Responsible" person's Outlook inbox, clearly labeled `[DRAFT]`, for them to copy into a new message and send.
6. Sends a daily digest email summarizing drafts created, to a specified address.
7. Flags sponsors who were contacted but haven't responded, and drafts a follow-up email the same way.

## Architecture

| Concern | Where |
|---|---|
| Master list, categories, contact status | Google Sheet (Drive) |
| Outreach guide + email template | Google Docs (Drive) |
| Sponsor/contact discovery | Apollo.io API |
| Draft delivery | Emailed to the sponsor row's Responsible person's Outlook inbox via `MailApp`, labeled `[DRAFT]` (see note below) |
| Name → Outlook email lookup | Standalone "IH Team Emails" spreadsheet, first tab with Name / Purdue Email columns (add/remove people directly in that Sheet, no code changes). A `TEAM_EMAILS_SPREADSHEET_ID` Script Property overrides the default sheet ID in `src/TeamDirectory.js` |
| Daily digest | Sent via the Apps Script account's Gmail (`MailApp`) to whatever address you configure — works regardless of the recipient's mail provider |
| Scheduling | Apps Script time-driven triggers |
| Duplicate prevention | A contact email already logged (non-blank Status or Last Contact) anywhere in the master list is skipped; a `LockService` script lock also stops overlapping runs (e.g. a manual run colliding with the daily trigger) from double-drafting |

**Why not real Outlook drafts:** creating an actual draft in someone's Outlook mailbox
requires the Microsoft Graph API, which needs an Azure AD app registration in the
school's Microsoft 365 tenant. Purdue's tenant has self-service app registration
disabled for regular users (confirmed: registering returns a 401 "You do not have
access"), so this project instead emails the composed draft to the reviewer's Outlook
inbox for them to copy and send manually. If IT ever grants app-registration access or
registers the app on your behalf, this can be upgraded to real Graph-based drafts.

Runs as a container-bound Apps Script attached to a Sheet living in the shared InnovateHer
Drive folder, so anyone on the finance team with edit access to that Sheet can open the
script, view logs, or trigger a manual run — no separate hosting account needed.

## Schedule

Installed via the Sheet menu **Sponsorship Outreach → Install triggers** (`installTriggers` in `src/Triggers.js`); times are America/New_York.

| Trigger | When | What it does |
|---|---|---|
| `runDailyProspecting` | Daily, ~7am | Finds new companies via Apollo (see budget below), looks up one contact per company once, appends them with a blank Responsible |
| `runScheduledOutreach` | Hourly, 8am–midnight | Drafts outreach for rows whose Responsible is in the IH Team Emails sheet |
| `sendScheduledDigest` | Daily, ~3pm | Emails drafts, follow-ups, and new prospects logged since the previous 3pm digest |

## Apollo credit budget

Prospecting is front-loaded against the Apollo credit cycle (300 credits, renews **Oct 26**),
based on a test run costing ~1.7 credits per company searched with ~1 in 3 yielding a contact.
The daily target changes automatically by date (`DAILY_PROSPECT_SCHEDULE` in `src/Prospecting.js`)
and is split between Local Businesses and In-Kind Sponsors.

| Period | Companies/day | Credits used | Contacts expected |
|---|---|---|---|
| 9/27 – 10/3 (7 days) | 8 | ~95 | ~19 |
| 10/4 – 10/10 (7 days) | 6 | ~70 | ~14 |
| 10/11 – 10/25 (15 days) | 3 | ~75 | ~15 |
| **Total** | **143 companies** | **~240** | **~48 contacts** |

~60 credits are held in reserve for contact lookups on existing rows that have no email
(each row is searched at most once — see the `[Apollo contact search …]` marker in Notes).
Check the Apollo balance after the first week: if well above ~205 remaining, raise the later
tiers; if below, lower them. After 10/25 the last tier (3/day) keeps applying until the
schedule is updated for the next cycle.

## Status

Scaffolding only right now. Still open:

- [x] Read the real master list schema across its 5 category tabs, by header name (`src/MasterList.js`) — `Purdue Funding` is excluded from automation on purpose
- [x] Bind this project to a real Apps Script deployment (`clasp create` via the Sheet's Extensions menu) and fill in `.clasp.json`
- [ ] Apollo.io API key, scoped to `mixed_companies/search`, `mixed_people/api_search`, `people/match` (created — add to Script Properties, not code)
- [ ] Set `DIGEST_RECIPIENT_EMAIL` Script Property (comma-separate multiple addresses)
- [ ] Fill in the "IH Team Emails" sheet (Name, Purdue Email) for each Responsible person — the Sheet menu **Sponsorship Outreach → Team Emails sheet (show link)** shows where it is
- [ ] Each category's email is still filled from one generic template (`src/Templates.js`) rather than the 5 distinct category templates in the outreach guide doc — not yet split out
- [x] Apollo contact-title search ranks results by the guide's priority tiers (University Recruiter first, etc.)

## Local setup (clasp)

```bash
npm install
npx clasp login
npx clasp create --type sheets --title "InnovateHer Sponsorship Outreach" --rootDir ./src
npx clasp push
```

Secrets and per-deployment config (Apollo API key, digest recipient) are never
committed to this repo — set them in the Apps Script editor under
**Project Settings → Script Properties** instead. Per-person draft routing
(Name → Purdue email) lives in the standalone "IH Team Emails" sheet, not Script Properties,
so it's easy for anyone on the team to edit directly.
