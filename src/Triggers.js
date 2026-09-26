function createDailyTrigger() {
  var existing = ScriptTriggers_('runDailyOutreach');
  if (existing.length) {
    Logger.log('Daily trigger already installed.');
    return;
  }

  ScriptApp.newTrigger('runDailyOutreach')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}

function ScriptTriggers_(handlerFunctionName) {
  return ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === handlerFunctionName;
  });
}
