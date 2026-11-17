/**
 * Main daily job: find uncontacted sponsors, discover contacts via Apollo when the
 * master list doesn't already have one, draft an outreach email, and send it for review.
 */

// Priority tiers from the Outreach Guide's "Find the Right Person" table, highest first.
// Matched as case-insensitive substrings of the contact's job title.
var SPONSOR_CONTACT_TITLE_TIERS = [
  ['University Recruit', 'Campus Recruit', 'Early Career', 'Early Talent', 'University Relations', 'University Programs'],
  ['Employer Brand', 'Recruitment Marketing', 'Talent Acquisition', 'Community Relations', 'Corporate Citizenship', 'Social Impact', 'Corporate Social Responsibility'],
  ['STEM Outreach', 'Education Partnership', 'Women in Tech', 'Women in Engineering', 'Women\'s Network', 'Women\'s ERG'],
  ['Brand Partnership', 'Experiential Marketing', 'Community Engagement', 'Sponsorship', 'Partnerships']
];

// Each enrichment costs an Apollo credit, so cap how many candidates we try per company.
var MAX_ENRICH_ATTEMPTS_PER_SPONSOR = 2;

// Per reviewer (the email address drafts actually go to), not a total across the whole
// run -- keeps each person's batch small enough that Gemini personalization stays within
// its per-minute rate limit instead of silently falling back to the plain template partway
// through. A sponsor skipped for being over the cap is left uncontacted and picked up by a
// later run, same as anyone skipped for any other reason below.
var MAX_DRAFTS_PER_REVIEWER_PER_RUN = 8;

function runDailyOutreach() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Another run is already in progress, skipping this one.');
    return;
  }

  var startMs = Date.now();
  try {
    var sponsors = getUncontactedSponsors();
    var draftsCreated = [];
    var emailsHandledThisRun = {};
    var draftCountByReviewer = {};

    for (var s = 0; s < sponsors.length; s++) {
      if (!hasTimeBudgetRemaining_(startMs, Date.now(), OUTREACH_RUN_TIME_BUDGET_MS)) {
        Logger.log('Stopping with ' + (sponsors.length - s) + ' sponsor(s) left to stay under the execution ' +
          'time limit; they are still "Brainstormed" and will be picked up by the next run.');
        break;
      }
      var sponsor = sponsors[s];
      try {
        var reviewerEmail = getResponsibleEmail_(sponsor.responsible);
        if (!reviewerEmail) {
          Logger.log('No Purdue email on file for "' + sponsor.responsible + '" (add them to the Team Emails sheet), skipping ' + sponsor.sponsorName);
          return;
        }

        var reviewerKey = reviewerEmail.toLowerCase();
        if ((draftCountByReviewer[reviewerKey] || 0) >= MAX_DRAFTS_PER_REVIEWER_PER_RUN) {
          Logger.log(reviewerEmail + ' already hit the ' + MAX_DRAFTS_PER_REVIEWER_PER_RUN +
            '-draft cap for this run, skipping ' + sponsor.sponsorName + ' until next run.');
          return;
        }

        var contact = resolveSponsorContact_(sponsor);
        if (!contact) {
          Logger.log('No contact found for ' + sponsor.sponsorName + ', skipping.');
          return;
        }

        var emailKey = contact.email.toLowerCase();
        if (emailsHandledThisRun[emailKey]) {
          Logger.log(contact.email + ' was already drafted to earlier in this run, skipping ' + sponsor.sponsorName);
          return;
        }

        var draft = draftOutreachEmail(sponsor.sponsorName, contact.firstName || 'there', sponsor.category, getResponsibleDisplayName_(sponsor.responsible), sponsor.notes);
        Logger.log('Drafting ' + sponsor.sponsorName + ': saving draft for ' + reviewerEmail);
        saveDraftForReview(sponsor.responsible, reviewerEmail, contact.email, draft.subject, draft.body);
        markDraftCreated(sponsor.sheetName, sponsor.rowNumber, contact.name, contact.email);
        Logger.log('Drafted ' + sponsor.sponsorName + ' -> ' + contact.email);
        emailsHandledThisRun[emailKey] = true;
        draftCountByReviewer[reviewerKey] = (draftCountByReviewer[reviewerKey] || 0) + 1;
        draftsCreated.push({ sponsorName: sponsor.sponsorName, contactEmail: contact.email });
      } catch (err) {
        Logger.log('Failed to process ' + sponsor.sponsorName + ': ' + err.message);
      }
    }

    var followUpsSent = runFollowUpsInternal_();
    logForDigest_('Outreach', draftsCreated);
    logForDigest_('Follow-up', followUpsSent);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Uses the master list's contact if present, otherwise looks one up via Apollo -- but
 * only once per row. The Notes marker stops the hourly runs from re-spending credits on
 * a company Apollo already came up empty for.
 */
function resolveSponsorContact_(sponsor) {
  if (sponsor.contactEmail) {
    return {
      name: sponsor.contactName,
      firstName: (sponsor.contactName || '').split(' ')[0],
      email: sponsor.contactEmail
    };
  }

  if (hasApolloSearchMarker_(sponsor.notes)) {
    // Rows Apollo came up empty for before the website fallback existed get one
    // website-only pass (no people search/enrichment), marked so it isn't repeated.
    if (!apolloMarkerSaysNoneFound_(sponsor.notes) || hasGeneralInboxMarker_(sponsor.notes)) return null;
    var knownOrg = apolloFindOrganization(sponsor.sponsorName);
    var inbox = knownOrg ? findGeneralCompanyEmail_(knownOrg) : null;
    if (!knownOrg) Logger.log('Apollo has no company record for ' + sponsor.sponsorName + ', so no website to check.');
    appendRowNote_(sponsor.sheetName, sponsor.rowNumber, generalInboxMarker_(inbox));
    if (inbox) setSponsorContact_(sponsor.sheetName, sponsor.rowNumber, inbox);
    return inbox;
  }

  var org = apolloFindOrganization(sponsor.sponsorName);
  var contact = org ? findContactAtOrganization_(org.id, org) : null;
  appendRowNote_(sponsor.sheetName, sponsor.rowNumber, apolloSearchMarker_(contact));
  // Save right away so a later drafting failure/timeout doesn't lose a paid-for contact.
  if (contact) setSponsorContact_(sponsor.sheetName, sponsor.rowNumber, contact);
  return contact;
}

/**
 * Looks up an email for sponsors already on the list that don't have one yet, up to
 * `maxLookups` companies (each Apollo search that came up empty is still marked so it
 * isn't retried indefinitely). Called before new-prospect discovery so Apollo credits go
 * to filling gaps in the existing list first. Returns { updated, attempted } -- `attempted`
 * (not just `updated`) is what should count against the day's Apollo credit budget, since
 * a miss still costs the search.
 */
function fillMissingSponsorEmails_(maxLookups) {
  var rows = getSponsorsMissingEmail_();
  var updated = [];
  var attempted = 0;

  for (var i = 0; i < rows.length && attempted < maxLookups; i++) {
    var row = rows[i];
    attempted++;
    try {
      var org = apolloFindOrganization(row.sponsorName);
      var contact = org ? findContactAtOrganization_(org.id, org) : null;
      appendRowNote_(row.sheetName, row.rowNumber, apolloSearchMarker_(contact));

      if (contact) {
        setSponsorContact_(row.sheetName, row.rowNumber, contact);
        updated.push({ sponsorName: row.sponsorName, contactEmail: contact.email });
      }
    } catch (err) {
      Logger.log('Email lookup failed for ' + row.sponsorName + ': ' + err.message);
    }
  }

  Logger.log('Found ' + updated.length + ' of ' + attempted + ' missing sponsor email(s) attempted: ' +
    updated.map(function (u) { return u.sponsorName + ' <' + u.contactEmail + '>'; }).join(', '));
  return { updated: updated, attempted: attempted };
}

var APOLLO_SEARCH_MARKER = 'Apollo contact search';

function apolloSearchMarker_(contact) {
  return '[' + APOLLO_SEARCH_MARKER + ' ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy') + ': ' +
    (contact ? (contact.isGeneralInbox ? 'general inbox from website' : 'found') : 'none found') + ']';
}

function hasApolloSearchMarker_(notes) {
  return String(notes || '').indexOf(APOLLO_SEARCH_MARKER) !== -1;
}

function apolloMarkerSaysNoneFound_(notes) {
  return /\[Apollo contact search [^\]]*: none found\]/.test(String(notes || ''));
}

var GENERAL_INBOX_MARKER = 'General inbox search';

function generalInboxMarker_(contact) {
  return '[' + GENERAL_INBOX_MARKER + ' ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy') + ': ' +
    (contact ? 'found' : 'none found') + ']';
}

function hasGeneralInboxMarker_(notes) {
  return String(notes || '').indexOf(GENERAL_INBOX_MARKER) !== -1;
}

/**
 * `org` (the Apollo organization record) is optional: when given and Apollo has no person
 * with a verified email, falls back to a general inbox (info@, support@, ...) found on
 * the company's own website. Callers that only pass an id get Apollo results only.
 */
function findContactAtOrganization_(organizationId, org) {
  var contact = findApolloPersonContact_(organizationId);
  if (contact || !org) return contact;
  return findGeneralCompanyEmail_(org);
}

function findApolloPersonContact_(organizationId) {
  var allTitles = [].concat.apply([], SPONSOR_CONTACT_TITLE_TIERS);
  var people = apolloFindPeopleAtOrganization(organizationId, allTitles);
  // Small brands often have nobody with a recruiting/CSR/partnerships title, so fall back
  // to everyone at the company -- ranking still puts the guide's preferred titles first.
  if (!people.length) {
    people = apolloFindPeopleAtOrganization(organizationId, []);
  }
  var ranked = rankSponsorContacts_(people);

  for (var i = 0; i < Math.min(ranked.length, MAX_ENRICH_ATTEMPTS_PER_SPONSOR); i++) {
    var enriched = apolloEnrichPerson(ranked[i].id);
    if (enriched && enriched.email) {
      return {
        name: enriched.name,
        firstName: enriched.first_name,
        email: enriched.email
      };
    }
  }
  return null;
}

// Pages tried, in order, on the company's site when Apollo has no usable person.
// /pages/contact is Shopify's default, which a lot of small in-kind brands run on.
var GENERAL_EMAIL_PAGE_PATHS = ['/', '/contact', '/contact-us', '/pages/contact', '/pages/contact-us', '/about'];

// Inbox prefixes in preference order: anything sponsorship-related first, then the
// catch-all general inboxes, then support/help as a last resort.
var GENERAL_EMAIL_PREFIX_PRIORITY = [
  'partnerships', 'partnership', 'partners', 'sponsorship', 'sponsorships', 'marketing', 'pr', 'press',
  'community', 'collabs', 'collab', 'info', 'hello', 'hi', 'contact', 'team', 'office',
  'support', 'help', 'customerservice', 'customercare', 'care', 'service'
];

var GENERAL_EMAIL_NOISE_ = /^(no-?reply|donotreply|privacy|legal|abuse|webmaster|postmaster|careers|jobs|hr|recruiting|unsubscribe)$/;

/**
 * Last-resort contact: a general inbox scraped from the company's own website (the domain
 * comes from Apollo's organization record). Only addresses on that same domain count, so a
 * third-party address embedded in the page (agency, payment processor) is never picked.
 * Returns null when Apollo has no domain for the company or nothing usable is on the site.
 */
function findGeneralCompanyEmail_(org) {
  var domain = companyDomain_(org);
  if (!domain) {
    Logger.log('Apollo has no website for ' + (org.name || 'this company') + ', so no general inbox to look for.');
    return null;
  }

  var found = {};
  for (var i = 0; i < GENERAL_EMAIL_PAGE_PATHS.length; i++) {
    extractEmailsFromPage_('https://' + domain + GENERAL_EMAIL_PAGE_PATHS[i]).forEach(function (email) {
      var parts = email.split('@');
      var host = parts[1];
      if ((host === domain || host.slice(-(domain.length + 1)) === '.' + domain) && !GENERAL_EMAIL_NOISE_.test(parts[0])) {
        found[email] = true;
      }
    });
    // Stop early once a preferred-prefix inbox turns up -- each page fetch costs execution time.
    if (Object.keys(found).some(function (e) { return generalEmailRank_(e) < GENERAL_EMAIL_PREFIX_PRIORITY.length; })) break;
  }

  var emails = Object.keys(found).sort(function (a, b) { return generalEmailRank_(a) - generalEmailRank_(b); });
  if (!emails.length) return null;

  Logger.log('Apollo had no contact for ' + (org.name || domain) + '; using general inbox ' + emails[0] + ' from its website.');
  return { name: 'General team', firstName: '', email: emails[0], isGeneralInbox: true };
}

function companyDomain_(org) {
  var raw = String(org.primary_domain || org.website_url || '').trim().toLowerCase();
  return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || '';
}

function extractEmailsFromPage_(url) {
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (response.getResponseCode() >= 400) return [];
    var html = response.getContentText().replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, '@');
    var matches = html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
    return matches
      .map(function (e) { return e.toLowerCase().replace(/^[._%+-]+/, ''); })
      .filter(function (e) { return !/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(e); });
  } catch (err) {
    Logger.log('Could not fetch ' + url + ' while looking for a general email: ' + err.message);
    return [];
  }
}

function generalEmailRank_(email) {
  var prefix = email.split('@')[0].replace(/[._-]/g, '');
  var i = GENERAL_EMAIL_PREFIX_PRIORITY.indexOf(prefix);
  return i === -1 ? GENERAL_EMAIL_PREFIX_PRIORITY.length : i;
}

function contactTitleTier_(title) {
  var t = String(title || '').toLowerCase();
  for (var i = 0; i < SPONSOR_CONTACT_TITLE_TIERS.length; i++) {
    var matches = SPONSOR_CONTACT_TITLE_TIERS[i].some(function (keyword) {
      return t.indexOf(keyword.toLowerCase()) !== -1;
    });
    if (matches) return i;
  }
  return SPONSOR_CONTACT_TITLE_TIERS.length;
}

/**
 * Best guide tier first; within a tier, people Apollo says have an email on file come
 * first so enrichment credits aren't spent on likely misses. Sort is stable, so Apollo's
 * own relevance order breaks remaining ties.
 */
function rankSponsorContacts_(people) {
  return people.slice().sort(function (a, b) {
    var tierDiff = contactTitleTier_(a.title) - contactTitleTier_(b.title);
    if (tierDiff) return tierDiff;
    return (b.has_email ? 1 : 0) - (a.has_email ? 1 : 0);
  });
}
