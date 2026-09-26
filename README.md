# InnovateHer Sponsorship Outreach Automation

Google Apps Script project (managed locally with [clasp](https://github.com/google/clasp))
that automates sponsor outreach for the InnovateHer hackathon finance team.

## What it does

1. Reads the outreach master list (a Sheet in the InnovateHer Drive) to find sponsors not yet contacted.
2. Uses the Apollo.io API to find contacts at those sponsor organizations.
3. Finds additional sponsor contacts outside the master list that fit a target category.
4. Uses the sponsorship outreach guide + final email template (Docs in Drive) to draft a personalized email.
5. Saves the draft to the contact's Outlook mailbox via the Microsoft Graph API.
6. Sends a daily digest email summarizing drafts created, to a specified address.
7. Flags sponsors who were contacted but haven't responded, and drafts a follow-up email the same way.

## Architecture

| Concern | Where |
|---|---|
| Master list, categories, contact status | Google Sheet (Drive) |
| Outreach guide + email template | Google Docs (Drive) |
| Sponsor/contact discovery | Apollo.io API |
| Draft creation | Outlook mailbox via Microsoft Graph API (per-user OAuth) |
| Daily digest | Sent via the Apps Script account's Gmail (`MailApp`) to whatever address you configure — works regardless of the recipient's mail provider |
| Scheduling | Apps Script time-driven triggers |

Runs as a container-bound Apps Script attached to a Sheet living in the shared InnovateHer
Drive folder, so anyone on the finance team with edit access to that Sheet can open the
script, view logs, or trigger a manual run — no separate hosting account needed.

## Status

Scaffolding only right now. Still open:

- [ ] Confirm the master list Sheet's column layout (`src/Config.js` documents the assumed schema — adjust to match reality)
- [ ] Register an Azure AD app in the school's Microsoft 365 tenant for Graph API access (`src/MicrosoftGraphAuth.js`)
- [ ] Apollo.io API key, scoped to `mixed_companies/search`, `mixed_people/api_search`, `people/match` (created — add to Script Properties, not code)
- [ ] Bind this project to a real Apps Script deployment (`clasp create`) and fill in `.clasp.json`

## Local setup (clasp)

```bash
npm install
npx clasp login
npx clasp create --type sheets --title "InnovateHer Sponsorship Outreach" --rootDir ./src
npx clasp push
```

Secrets (Apollo API key, Microsoft OAuth client ID/secret, digest recipient) are never
committed to this repo — set them in the Apps Script editor under
**Project Settings → Script Properties** instead.
