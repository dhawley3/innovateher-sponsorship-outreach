function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sponsorship Outreach')
    .addItem('Run outreach now', 'runDailyOutreach')
    .addItem('Run follow-ups now', 'runFollowUps')
    .addSeparator()
    .addItem('Team Emails sheet (show link)', 'openTeamEmailsSheet')
    .addSeparator()
    .addItem('Install triggers (7am prospecting, hourly outreach, 3pm digest)', 'installTriggers')
    .addToUi();
}
