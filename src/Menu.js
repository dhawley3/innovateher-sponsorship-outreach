function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sponsorship Outreach')
    .addItem('Run outreach now', 'runDailyOutreach')
    .addItem('Run follow-ups now', 'runFollowUps')
    .addSeparator()
    .addItem('Install daily trigger', 'createDailyTrigger')
    .addToUi();
}
