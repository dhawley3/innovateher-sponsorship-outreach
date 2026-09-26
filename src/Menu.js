function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sponsorship Outreach')
    .addItem('Authorize my Outlook account', 'authorizeMicrosoft')
    .addSeparator()
    .addItem('Run outreach now', 'runDailyOutreach')
    .addItem('Run follow-ups now', 'runFollowUps')
    .addSeparator()
    .addItem('Install daily trigger', 'createDailyTrigger')
    .addToUi();
}
