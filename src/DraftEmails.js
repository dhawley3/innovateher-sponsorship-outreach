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
 * Draft in the Apps Script project's own Gmail account (whoever runs/owns the script --
 * GmailApp always acts as that identity, never as an arbitrary teammate). Created alongside
 * the Outlook draft/fallback below as a second copy, not a replacement, so this is a visible
 * backstop even when a teammate's Outlook auth or Graph call is having problems.
 */
function createGmailDraft_(sponsorContactEmail, subject, body) {
  GmailApp.createDraft(sponsorContactEmail, subject, body);
}

/**
 * Real draft in the responsible teammate's OWN mailbox when they've authorized one --
 * their Gmail first (GmailDraftsAuth.js), then their Outlook (MicrosoftGraphAuth.js) --
 * otherwise the emailed-notification fallback above. personKey is the same lowercased
 * first name used for the Team Emails lookup (sponsor.responsible). Also always leaves a
 * copy in the script account's own Gmail Drafts folder, regardless of which path ran.
 */
function saveDraftForReview(personKey, reviewerEmail, sponsorContactEmail, subject, body) {
  try {
    createGmailDraft_(sponsorContactEmail, subject, body);
  } catch (err) {
    Logger.log('Gmail draft creation failed for ' + sponsorContactEmail + ': ' + err.message);
  }

  if (isGmailDraftsAuthorizedForTeammate(personKey)) {
    try {
      createGmailDraftForTeammate(personKey, sponsorContactEmail, subject, body);
      return;
    } catch (err) {
      Logger.log('Teammate Gmail draft creation failed for ' + personKey + ', trying Outlook next: ' + err.message);
    }
  }

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
