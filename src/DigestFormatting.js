/**
 * Pure formatter for the "Skipped this run" section of the daily digest. Split out so the
 * grouping/wording logic can be unit tested without a live Spreadsheet or MailApp. See
 * logSkipsForDigest_ (OutreachWorkflow.js / FollowUpWorkflow.js) for how skip events get
 * collected, and sendDailyDigest (DailyDigest.js) for where this gets used.
 *
 * Before this, a sponsor skipped for "no Purdue email on file" or any other reason only
 * ever showed up in the Apps Script execution log -- which nobody reads unless they already
 * suspect something's wrong. A teammate missing from the Team Emails sheet meant every one
 * of their sponsors was silently dropped, every single run, with no visible trace.
 */
function formatSkippedForDigest_(skipped) {
  if (!skipped || !skipped.length) {
    return ['  (nothing skipped)'];
  }

  var sponsorsByReason = {};
  var reasonsInFirstSeenOrder = [];

  skipped.forEach(function (item) {
    var reason = item.reason || 'unknown reason';
    if (!sponsorsByReason[reason]) {
      sponsorsByReason[reason] = [];
      reasonsInFirstSeenOrder.push(reason);
    }
    sponsorsByReason[reason].push(item.sponsorName);
  });

  return reasonsInFirstSeenOrder.map(function (reason) {
    return '  - ' + reason + ': ' + sponsorsByReason[reason].join(', ');
  });
}
