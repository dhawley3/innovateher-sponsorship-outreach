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

function runDailyOutreach() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Another run is already in progress, skipping this one.');
    return;
  }

  try {
    var sponsors = getUncontactedSponsors();
    var draftsCreated = [];
    var emailsHandledThisRun = {};

    sponsors.forEach(function (sponsor) {
      try {
        var reviewerEmail = getResponsibleEmail_(sponsor.responsible);
        if (!reviewerEmail) {
          Logger.log('No Purdue email on file for "' + sponsor.responsible + '" (add them to the Team Emails sheet), skipping ' + sponsor.sponsorName);
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
        saveDraftForReview(sponsor.responsible, reviewerEmail, contact.email, draft.subject, draft.body);
        markDraftCreated(sponsor.sheetName, sponsor.rowNumber, contact.name, contact.email);
        emailsHandledThisRun[emailKey] = true;
        draftsCreated.push({ sponsorName: sponsor.sponsorName, contactEmail: contact.email });
      } catch (err) {
        Logger.log('Failed to process ' + sponsor.sponsorName + ': ' + err.message);
      }
    });

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

  if (hasApolloSearchMarker_(sponsor.notes)) return null;

  var org = apolloFindOrganization(sponsor.sponsorName);
  var contact = org ? findContactAtOrganization_(org.id) : null;
  appendRowNote_(sponsor.sheetName, sponsor.rowNumber, apolloSearchMarker_(contact));
  return contact;
}

var APOLLO_SEARCH_MARKER = 'Apollo contact search';

function apolloSearchMarker_(contact) {
  return '[' + APOLLO_SEARCH_MARKER + ' ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy') + ': ' +
    (contact ? 'found' : 'none found') + ']';
}

function hasApolloSearchMarker_(notes) {
  return String(notes || '').indexOf(APOLLO_SEARCH_MARKER) !== -1;
}

function findContactAtOrganization_(organizationId) {
  var allTitles = [].concat.apply([], SPONSOR_CONTACT_TITLE_TIERS);
  var ranked = rankSponsorContacts_(apolloFindPeopleAtOrganization(organizationId, allTitles));

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
