/**
 * Emails a summary of the day's run to the configured recipient. Uses MailApp (Gmail),
 * which works fine as a send-to address regardless of whether that address is Outlook.
 */

function sendDailyDigest(draftsCreated, followUpsSent) {
  var recipient = getDigestRecipient_();
  var lines = [];

  lines.push('New outreach drafts: ' + draftsCreated.length);
  draftsCreated.forEach(function (d) {
    lines.push('  - ' + d.sponsorName + ' -> ' + d.contactEmail);
  });

  lines.push('');
  lines.push('Follow-up drafts: ' + followUpsSent.length);
  followUpsSent.forEach(function (f) {
    lines.push('  - ' + f.sponsorName + ' -> ' + f.contactEmail);
  });

  MailApp.sendEmail({
    to: recipient,
    subject: 'InnovateHer Sponsorship Outreach - Daily Digest',
    body: lines.join('\n')
  });
}
