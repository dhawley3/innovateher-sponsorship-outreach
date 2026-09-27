/**
 * Every draft/follow-up is logged to a hidden "Digest Log" tab as it's created, and the
 * 3pm digest trigger emails everything logged since the previous digest, then clears it --
 * so each digest covers 3pm yesterday through 3pm today. Uses MailApp (Gmail), which works
 * fine as a send-to address regardless of whether that address is Outlook.
 * DIGEST_RECIPIENT_EMAIL may hold a single address or a comma-separated list.
 */

var DIGEST_LOG_SHEET_NAME = 'Digest Log';

function getDigestLogSheet_() {
  var ss = SpreadsheetApp.openById(getMasterListSpreadsheetId_());
  var sheet = ss.getSheetByName(DIGEST_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DIGEST_LOG_SHEET_NAME);
    sheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Type', 'Sponsor', 'Contact Email']]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  return sheet;
}

function logForDigest_(type, items) {
  if (!items.length) return;
  var now = new Date();
  var sheet = getDigestLogSheet_();
  var rows = items.map(function (item) {
    return [now, type, item.sponsorName, item.contactEmail];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
}

/**
 * Trigger handler. Holds the script lock so an outreach run can't append to the log
 * between reading it and clearing it.
 */
function sendScheduledDigest() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5 * 60 * 1000)) {
    throw new Error('Outreach run still in progress after 5 minutes, digest not sent.');
  }

  try {
    var sheet = getDigestLogSheet_();
    var lastRow = sheet.getLastRow();
    var rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 4).getValues() : [];

    var buckets = { 'Outreach': [], 'Follow-up': [], 'Prospect': [] };
    rows.forEach(function (row) {
      (buckets[row[1]] || buckets['Outreach']).push({ sponsorName: row[2], contactEmail: row[3] });
    });

    sendDailyDigest(buckets['Outreach'], buckets['Follow-up'], buckets['Prospect']);

    if (rows.length) sheet.deleteRows(2, rows.length);
  } finally {
    lock.releaseLock();
  }
}

function sendDailyDigest(draftsCreated, followUpsSent, prospectsAdded) {
  var recipients = getDigestRecipient_()
    .split(',')
    .map(function (email) { return email.trim(); })
    .filter(function (email) { return email; })
    .join(',');
  var lines = [];

  lines.push('Drafts created since yesterday\'s 3pm digest.');
  lines.push('');
  lines.push('New outreach drafts: ' + draftsCreated.length);
  draftsCreated.forEach(function (d) {
    lines.push('  - ' + d.sponsorName + ' -> ' + d.contactEmail);
  });

  lines.push('');
  lines.push('Follow-up drafts: ' + followUpsSent.length);
  followUpsSent.forEach(function (f) {
    lines.push('  - ' + f.sponsorName + ' -> ' + f.contactEmail);
  });

  lines.push('');
  lines.push('New prospects added (put your name in Responsible to get a draft): ' + prospectsAdded.length);
  prospectsAdded.forEach(function (p) {
    lines.push('  - ' + p.sponsorName + ' -> ' + p.contactEmail);
  });

  MailApp.sendEmail({
    to: recipients,
    subject: 'InnovateHer Sponsorship Outreach - Daily Digest',
    body: lines.join('\n')
  });
}
