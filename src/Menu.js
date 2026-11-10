function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sponsorship Outreach')
    .addItem('Run outreach now', 'runDailyOutreach')
    .addItem('Run follow-ups now', 'runFollowUps')
    .addSeparator()
    .addItem('Team Emails sheet (show link)', 'openTeamEmailsSheet')
    .addSeparator()
    .addItem('Install triggers (prospecting 7am/11am/3pm/7pm, hourly outreach, 3pm digest)', 'installTriggers')
    .addToUi();
}
