var OUTREACH_WINDOW_START_HOUR = 8;
var DIGEST_HOUR = 15;
var PROSPECTING_HOUR = 7;

/**
 * Replaces any existing triggers with a daily 7am prospect discovery, an hourly outreach
 * run, and a daily 3pm digest.
 * Apps Script can't limit a time-based trigger to certain hours, so runScheduledOutreach
 * checks the window itself.
 */
function installTriggers() {
  ['runDailyOutreach', 'runScheduledOutreach', 'sendScheduledDigest', 'runDailyProspecting'].forEach(function (name) {
    ScriptTriggers_(name).forEach(function (t) { ScriptApp.deleteTrigger(t); });
  });

  ScriptApp.newTrigger('runDailyProspecting')
    .timeBased()
    .everyDays(1)
    .atHour(PROSPECTING_HOUR)
    .nearMinute(0)
    .create();

  ScriptApp.newTrigger('runScheduledOutreach')
    .timeBased()
    .everyHours(1)
    .create();

  ScriptApp.newTrigger('sendScheduledDigest')
    .timeBased()
    .everyDays(1)
    .atHour(DIGEST_HOUR)
    .nearMinute(0)
    .create();
}

function runScheduledOutreach() {
  var hour = Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'H'));
  if (hour < OUTREACH_WINDOW_START_HOUR) {
    Logger.log('Outside the 8am-midnight outreach window (hour ' + hour + '), skipping.');
    return;
  }
  runDailyOutreach();
}

function ScriptTriggers_(handlerFunctionName) {
  return ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === handlerFunctionName;
  });
}
