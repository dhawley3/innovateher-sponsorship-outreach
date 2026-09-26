# InnovateHer Sponsorship Outreach Automation

Google Apps Script project (managed locally with [clasp](https://github.com/google/clasp))
that automates sponsor outreach for the InnovateHer hackathon finance team.

## What it does

1. Reads the outreach master list (a Sheet in the InnovateHer Drive) to find sponsors not yet contacted.
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
| Name → Outlook email lookup | "Team Emails" tab in the master list spreadsheet (add/remove people directly in the Sheet, no code changes) |
| Daily digest | Sent via the Apps Script account's Gmail (`MailApp`) to whatever address you configure — works regardless of the recipient's mail provider |
| Scheduling | Apps Script time-driven triggers |

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

## Status

Scaffolding only right now. Still open:

- [ ] Confirm the master list Sheet's column layout (`src/Config.js` documents the assumed schema — the real sheet has multiple category tabs (Warm Contacts, Mass Monetary Sponsors, In-Kind Sponsors, Women-Owned, Local Businesses), each mapping to one of the 5 templates in the outreach guide; `Purdue Funding` is excluded from automation for now. This still needs a proper rewrite.)
- [ ] Apollo.io API key, scoped to `mixed_companies/search`, `mixed_people/api_search`, `people/match` (created — add to Script Properties, not code)
- [ ] Bind this project to a real Apps Script deployment (`clasp create`) and fill in `.clasp.json`
- [ ] Set `DIGEST_RECIPIENT_EMAIL` Script Property
- [ ] Fill in the "Team Emails" tab (Name, Purdue Email) for each Responsible person — use the Sheet's menu: **Sponsorship Outreach → Set up / open Team Emails sheet**

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
(Name → Purdue email) lives in the "Team Emails" sheet tab, not Script Properties,
so it's easy for anyone on the team to edit directly.
