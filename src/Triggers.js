var OUTREACH_WINDOW_START_HOUR = 8;
var DIGEST_HOUR = 15;
// Apollo prospecting runs per day; the daily company target is split across them
// (see prospectRunTarget_ in src/Prospecting.js).
var PROSPECTING_HOURS = [7, 11, 15, 19];

/**
 * Replaces any existing triggers with prospect discovery at each of PROSPECTING_HOURS,
 * an hourly outreach run, and a daily 3pm digest.
 * Apps Script can't limit a time-based trigger to certain hours, so runScheduledOutreach
 * checks the window itself.
 */
function installTriggers() {
  ['runDailyOutreach', 'runScheduledOutreach', 'sendScheduledDigest', 'runDailyProspecting'].forEach(function (name) {
    ScriptTriggers_(name).forEach(function (t) { ScriptApp.deleteTrigger(t); });
  });

  PROSPECTING_HOURS.forEach(function (hour) {
    ScriptApp.newTrigger('runDailyProspecting')
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .nearMinute(0)
      .create();
  });

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
