/**
 * Email-fallback for saving drafts, used for any teammate who hasn't authorized
 * Microsoft Graph yet (or Purdue-only teammates, since Purdue's tenant currently blocks
 * consent to this app). The composed email gets sent straight to the reviewer's inbox,
 * clearly labeled as a draft, so they can copy it into a new message and send it.
 */
function sendDraftForReview(reviewerEmail, sponsorContactEmail, subject, body) {
  var wrappedBody = [
    '[DRAFT - review before sending]',
    'Intended recipient: ' + sponsorContactEmail,
    'Subject: ' + subject,
    '',
    '---',
    '',
    body
  ].join('\n');

  MailApp.sendEmail({
    to: reviewerEmail,
    subject: '[DRAFT] ' + subject,
    body: wrappedBody
  });
}

/**
 * Real Outlook draft when the responsible teammate has authorized Microsoft Graph,
 * otherwise the emailed-notification fallback above. personKey is the same lowercased
 * first name used for the Team Emails lookup (sponsor.responsible).
 */
function saveDraftForReview(personKey, reviewerEmail, sponsorContactEmail, subject, body) {
  if (isOutlookAuthorizedForTeammate(personKey)) {
    try {
      createOutlookDraft(personKey, sponsorContactEmail, subject, body);
      return;
    } catch (err) {
      Logger.log('Outlook draft creation failed for ' + personKey + ', falling back to email: ' + err.message);
    }
  }

  sendDraftForReview(reviewerEmail, sponsorContactEmail, subject, body);
}
