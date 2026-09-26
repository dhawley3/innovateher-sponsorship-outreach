/**
 * Main daily job: find uncontacted sponsors, discover contacts via Apollo when the
 * master list doesn't already have one, draft an outreach email, and send it for review.
 */

// Job titles that qualify a sponsor contact -- adjust to match the outreach guide's categories.
var SPONSOR_CONTACT_TITLES = ['Partnerships', 'Sponsorship', 'Marketing', 'Community Relations', 'CSR'];

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

        var body = draftOutreachEmailBody(sponsor.sponsorName, contact.firstName, sponsor.category);
        sendDraftForReview(reviewerEmail, contact.email, 'Partnership opportunity with InnovateHer', body);
        markSponsorContacted(sponsor.sheetName, sponsor.rowNumber, contact.name, contact.email);
        emailsHandledThisRun[emailKey] = true;
        draftsCreated.push({ sponsorName: sponsor.sponsorName, contactEmail: contact.email });
      } catch (err) {
        Logger.log('Failed to process ' + sponsor.sponsorName + ': ' + err.message);
      }
    });

    var followUpsSent = runFollowUpsInternal_();
    sendDailyDigest(draftsCreated, followUpsSent);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Uses the master list's contact if present, otherwise looks one up via Apollo.
 */
function resolveSponsorContact_(sponsor) {
  if (sponsor.contactEmail) {
    return {
      name: sponsor.contactName,
      firstName: (sponsor.contactName || '').split(' ')[0],
      email: sponsor.contactEmail
    };
  }

  var org = apolloFindOrganization(sponsor.sponsorName);
  if (!org) return null;

  var people = apolloFindPeopleAtOrganization(org.id, SPONSOR_CONTACT_TITLES);
  if (!people.length) return null;

  var enriched = apolloEnrichPerson(people[0].id);
  if (!enriched || !enriched.email) return null;

  return {
    name: enriched.name,
    firstName: enriched.first_name,
    email: enriched.email
  };
}
