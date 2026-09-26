/**
 * Drafts a follow-up for sponsors contacted more than FOLLOW_UP_WAIT_DAYS ago with no response.
 */

var FOLLOW_UP_WAIT_DAYS = 7;

function runFollowUps() {
  var pending = getSponsorsAwaitingResponse(FOLLOW_UP_WAIT_DAYS);
  var followUpsSent = [];

  pending.forEach(function (sponsor) {
    try {
      var firstName = (sponsor.contactName || '').split(' ')[0];
      var body = draftFollowUpEmailBody(sponsor.sponsorName, firstName, sponsor.category);
      sendDraftForReview(sponsor.contactEmail, 'Following up: partnership opportunity with InnovateHer', body);
      markFollowUpSent(sponsor.rowNumber);
      followUpsSent.push({ sponsorName: sponsor.sponsorName, contactEmail: sponsor.contactEmail });
    } catch (err) {
      Logger.log('Failed to draft follow-up for ' + sponsor.sponsorName + ': ' + err.message);
    }
  });

  return followUpsSent;
}
