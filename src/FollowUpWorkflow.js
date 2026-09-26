/**
 * Drafts a follow-up for sponsors contacted more than FOLLOW_UP_WAIT_DAYS ago with no response.
 */

var FOLLOW_UP_WAIT_DAYS = 7;

function runFollowUps() {
  var pending = getSponsorsAwaitingResponse(FOLLOW_UP_WAIT_DAYS);
  var followUpsSent = [];

  pending.forEach(function (sponsor) {
    try {
      var reviewerEmail = getResponsibleEmail_(sponsor.responsible);
      if (!reviewerEmail) {
        Logger.log('No Purdue email on file for "' + sponsor.responsible + '" (add them to the Team Emails sheet), skipping follow-up for ' + sponsor.sponsorName);
        return;
      }

      var firstName = (sponsor.contactName || '').split(' ')[0];
      var body = draftFollowUpEmailBody(sponsor.sponsorName, firstName, sponsor.category);
      sendDraftForReview(reviewerEmail, sponsor.contactEmail, 'Following up: partnership opportunity with InnovateHer', body);
      markFollowUpSent(sponsor.rowNumber);
      followUpsSent.push({ sponsorName: sponsor.sponsorName, contactEmail: sponsor.contactEmail });
    } catch (err) {
      Logger.log('Failed to draft follow-up for ' + sponsor.sponsorName + ': ' + err.message);
    }
  });

  return followUpsSent;
}
