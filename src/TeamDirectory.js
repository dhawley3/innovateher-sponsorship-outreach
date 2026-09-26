/**
 * Maps a team member's first name (the master list's "Responsible" column) to their
 * Purdue email. Kept as a plain "Team Emails" tab in the master list spreadsheet so
 * anyone can add, remove, or fix an entry directly in the Sheet -- no code changes.
 */

var TEAM_DIRECTORY_SHEET_NAME = 'Team Emails';

function ensureTeamDirectorySheet_() {
  var ss = SpreadsheetApp.openById(getMasterListSpreadsheetId_());
  var sheet = ss.getSheetByName(TEAM_DIRECTORY_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TEAM_DIRECTORY_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['Name', 'Purdue Email']]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

var teamDirectoryCache_ = null;

/**
 * Cached for the lifetime of a single execution -- getResponsibleEmail_ is called
 * once per sponsor row (hundreds of times per run), and re-reading the sheet that
 * often was the main reason a full run took minutes.
 */
function getTeamDirectory_() {
  if (teamDirectoryCache_) return teamDirectoryCache_;

  var sheet = ensureTeamDirectorySheet_();
  var values = sheet.getDataRange().getValues();
  var directory = {};

  for (var i = 1; i < values.length; i++) {
    var name = String(values[i][0] || '').trim().toLowerCase();
    var email = String(values[i][1] || '').trim();
    if (name && email) {
      directory[name] = email;
    }
  }

  teamDirectoryCache_ = directory;
  return directory;
}

/**
 * Returns the Purdue email for a first name (e.g. "Ria"), or null if that
 * person hasn't been added to the Team Emails tab yet.
 */
function getResponsibleEmail_(name) {
  var directory = getTeamDirectory_();
  var key = String(name || '').trim().toLowerCase();
  return directory[key] || null;
}
