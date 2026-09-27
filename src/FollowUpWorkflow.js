/**
 * Drafts a follow-up for sponsors contacted more than FOLLOW_UP_WAIT_DAYS ago with no response.
 */

var FOLLOW_UP_WAIT_DAYS = 7;

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

  pending.forEach(function (sponsor) {
    try {
      var reviewerEmail = getResponsibleEmail_(sponsor.responsible);
      if (!reviewerEmail) {
        Logger.log('No Purdue email on file for "' + sponsor.responsible + '" (add them to the Team Emails sheet), skipping follow-up for ' + sponsor.sponsorName);
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
      followUpsSent.push({ sponsorName: sponsor.sponsorName, contactEmail: sponsor.contactEmail });
    } catch (err) {
      Logger.log('Failed to draft follow-up for ' + sponsor.sponsorName + ': ' + err.message);
    }
  });

  return followUpsSent;
}
