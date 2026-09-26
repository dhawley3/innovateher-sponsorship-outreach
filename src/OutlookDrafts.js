/**
 * Creates a real draft in the authorized user's Outlook mailbox via Microsoft Graph.
 * Requires authorizeMicrosoft() to have been run successfully for the current user.
 */

function createOutlookDraft(toEmail, subject, bodyText) {
  var service = getMicrosoftService_();
  if (!service.hasAccess()) {
    throw new Error('Not authorized with Microsoft Graph. Run authorizeMicrosoft() first.');
  }

  var response = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + service.getAccessToken() },
    payload: JSON.stringify({
      subject: subject,
      body: { contentType: 'Text', content: bodyText },
      toRecipients: [{ emailAddress: { address: toEmail } }]
    }),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code >= 300) {
    throw new Error('Microsoft Graph error (' + code + '): ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}
