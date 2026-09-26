/**
 * Emails a summary of the day's run to the configured recipient(s). Uses MailApp (Gmail),
 * which works fine as a send-to address regardless of whether that address is Outlook.
 * DIGEST_RECIPIENT_EMAIL may hold a single address or a comma-separated list.
 */

function sendDailyDigest(draftsCreated, followUpsSent) {
  var recipients = getDigestRecipient_()
    .split(',')
    .map(function (email) { return email.trim(); })
    .filter(function (email) { return email; })
    .join(',');
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
    to: recipients,
    subject: 'InnovateHer Sponsorship Outreach - Daily Digest',
    body: lines.join('\n')
  });
}
