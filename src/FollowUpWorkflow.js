/**
 * Drafts a follow-up for sponsors contacted more than FOLLOW_UP_WAIT_DAYS ago with no response.
 */

var FOLLOW_UP_WAIT_DAYS = 7;

// Safety floor: a Last Contact date before this predates this guard (added after stale/test
// "Contacted" rows with old dates caused a mass follow-up send -- see getSponsorsAwaitingResponse
// in src/MasterList.js) and is permanently excluded, no matter how old it is. Only sponsors
// actually contacted on or after this date are eligible for the normal FOLLOW_UP_WAIT_DAYS wait.
var FOLLOW_UP_MIN_CONTACT_DATE = new Date('2026-10-01');

/**
 * Menu-facing entry point -- acquires its own lock, since it can run independently
 * of runDailyOutreach (which already holds the lock when it calls runFollowUpsInternal_ directly).
 */
function runFollowUps() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Another run is already in progress, skipping this one.');
    return [];
  }

  try {
    return runFollowUpsInternal_();
  } finally {
    lock.releaseLock();
  }
}

function runFollowUpsInternal_() {
  var pending = getSponsorsAwaitingResponse(FOLLOW_UP_WAIT_DAYS);
  var followUpsSent = [];
  var emailsHandledThisRun = {};
  var draftCountByReviewer = {};

  pending.forEach(function (sponsor) {
    try {
      var reviewerEmail = getResponsibleEmail_(sponsor.responsible);
      if (!reviewerEmail) {
        Logger.log('No Purdue email on file for "' + sponsor.responsible + '" (add them to the Team Emails sheet), skipping follow-up for ' + sponsor.sponsorName);
        return;
      }

      // Same per-reviewer cap as the initial outreach drafts (MAX_DRAFTS_PER_REVIEWER_PER_RUN,
      // src/OutreachWorkflow.js) -- without it, a large backlog of overdue follow-ups for one
      // person all go out in a single run with no rate limiting at all.
      var reviewerKey = reviewerEmail.toLowerCase();
      if ((draftCountByReviewer[reviewerKey] || 0) >= MAX_DRAFTS_PER_REVIEWER_PER_RUN) {
        Logger.log(reviewerEmail + ' already hit the ' + MAX_DRAFTS_PER_REVIEWER_PER_RUN +
          '-draft cap for this run, skipping follow-up for ' + sponsor.sponsorName + ' until next run.');
        return;
      }

      var emailKey = String(sponsor.contactEmail || '').toLowerCase();
      if (emailKey && emailsHandledThisRun[emailKey]) {
        Logger.log(sponsor.contactEmail + ' already got a follow-up drafted earlier in this run, skipping ' + sponsor.sponsorName);
        return;
      }

      var firstName = (sponsor.contactName || '').split(' ')[0] || 'there';
      var draft = draftFollowUpEmail(sponsor.sponsorName, firstName, getResponsibleDisplayName_(sponsor.responsible));
      saveDraftForReview(sponsor.responsible, reviewerEmail, sponsor.contactEmail, draft.subject, draft.body);
      markFollowUpSent(sponsor.sheetName, sponsor.rowNumber);
      if (emailKey) emailsHandledThisRun[emailKey] = true;
      draftCountByReviewer[reviewerKey] = (draftCountByReviewer[reviewerKey] || 0) + 1;
      followUpsSent.push({ sponsorName: sponsor.sponsorName, contactEmail: sponsor.contactEmail });
    } catch (err) {
      Logger.log('Failed to draft follow-up for ' + sponsor.sponsorName + ': ' + err.message);
    }
  });

  return followUpsSent;
}
