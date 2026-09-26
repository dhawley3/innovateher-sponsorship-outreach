/**
 * Email-fallback for saving drafts: Purdue's Azure AD tenant blocks self-service
 * app registration, so we can't create real Outlook drafts via Microsoft Graph.
 * Instead, the composed email gets sent straight to the reviewer's Outlook inbox,
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
