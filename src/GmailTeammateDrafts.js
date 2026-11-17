/**
 * Creates a real draft in a teammate's own authorized Gmail account via the Gmail API's
 * /users/me/drafts endpoint (using HER OAuth token, from GmailDraftsAuth.js -- GmailApp
 * itself can't act as anyone but the Apps Script project's own identity). This is the
 * real-Gmail-drafts alternative to sendDraftForReview()'s emailed-notification fallback,
 * parallel to how createOutlookDraft() is the real-Outlook-drafts alternative -- callers
 * should check isGmailDraftsAuthorizedForTeammate(personKey) first and fall back to
 * sendDraftForReview() if that teammate hasn't authorized yet.
 */
function createGmailDraftForTeammate(personKey, toEmail, subject, body) {
  var service = getGmailDraftsServiceFor_(personKey);
  if (!service.hasAccess()) {
    throw new Error('"' + personKey + '" has not authorized Gmail drafts yet. Run authorizeGmailDraftsForTeammate("' + personKey + '") from the editor and send them the URL it logs.');
  }

  var mime = [
    'To: ' + toEmail,
    'Subject: ' + subject,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body
  ].join('\r\n');
  var rawMessage = Utilities.base64EncodeWebSafe(mime);

  var response = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + service.getAccessToken() },
    payload: JSON.stringify({ message: { raw: rawMessage } }),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Gmail draft creation failed (' + code + '): ' + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

/**
 * Quick manual test -- run from the editor after authorizeGmailDraftsForTeammate(personKey)
 * succeeds to confirm a draft actually lands in that teammate's Gmail Drafts folder before
 * relying on it in the real workflows.
 */
function testCreateGmailDraftForTeammate(personKey) {
  personKey = personKey || 'ruchira';
  var draft = createGmailDraftForTeammate(
    personKey,
    getDigestRecipient_(),
    '[Test] InnovateHer per-teammate Gmail draft integration',
    'If you can see this in your Gmail Drafts folder, the per-teammate Gmail draft integration works.'
  );
  Logger.log('Created draft id: ' + draft.id);
}
