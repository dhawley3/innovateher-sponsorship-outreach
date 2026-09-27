/**
 * Creates a real draft in a teammate's authorized Outlook mailbox via Microsoft Graph's
 * /me/messages endpoint (POSTing a message with no sendMail call leaves it as a draft).
 * This is the real-Outlook-drafts alternative to sendDraftForReview()'s emailed-notification
 * fallback -- callers should check isOutlookAuthorizedForTeammate(personKey) first and fall
 * back to sendDraftForReview() if that teammate hasn't authorized yet.
 */
function createOutlookDraft(personKey, toEmail, subject, body) {
  var service = getMsGraphServiceFor_(personKey);
  if (!service.hasAccess()) {
    throw new Error('"' + personKey + '" has not authorized Microsoft Graph yet. Run authorizeOutlookForTeammate("' + personKey + '") from the editor and send them the URL it logs.');
  }

  var payload = {
    subject: subject,
    body: {
      contentType: 'Text',
      content: body
    },
    toRecipients: [
      { emailAddress: { address: toEmail } }
    ]
  };

  var response = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + service.getAccessToken() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code !== 201) {
    throw new Error('Graph draft creation failed (' + code + '): ' + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

/**
 * Quick manual test -- run from the editor after authorizeOutlookForTeammate(personKey)
 * succeeds to confirm a draft actually lands in that teammate's Drafts folder before
 * relying on it in the real workflows.
 */
function testCreateOutlookDraft(personKey) {
  personKey = personKey || 'drew';
  var draft = createOutlookDraft(
    personKey,
    getDigestRecipient_(),
    '[Test] InnovateHer Outlook draft integration',
    'If you can see this in your Drafts folder, the Graph integration works.'
  );
  Logger.log('Created draft id: ' + draft.id);
}

/**
 * One-off manual demo: drafts a real cold-outreach email (real template, real sponsor
 * contact) and creates it as an actual Outlook draft for drew -- addressed to the sponsor
 * contact, but never sent, so nothing goes out. Doesn't touch the master list at all.
 */
function draftRealSponsorEmailForDrew() {
  var draft = draftOutreachEmail('JPMorgan Chase', 'Ryan', 'Warm Contacts', getResponsibleDisplayName_('Drew'));
  var created = createOutlookDraft('drew', 'ryan.mccann@jpmorgan.com', draft.subject, draft.body);
  Logger.log('Created draft id: ' + created.id);
}
