/**
 * Maps a team member's first name (the master list's "Responsible" column) to their
 * Purdue email. Lives in the standalone "IH Team Emails" spreadsheet (first tab: Name,
 * Purdue Email), separate from the master list, so anyone can add, remove, or fix an
 * entry directly in that Sheet -- no code changes. A TEAM_EMAILS_SPREADSHEET_ID Script
 * Property overrides the default ID below.
 */

var TEAM_EMAILS_SPREADSHEET_DEFAULT_ID = '1cLyXCvLzKc3ydKgvqNKYcqtf7vDvapM1YTjYTwYbenM';
var LEGACY_TEAM_EMAILS_TAB_NAME = 'Team Emails';

/**
 * Returns the directory tab. While it has no people yet, copies them over from the
 * master list's old "Team Emails" tab (adding the header row if that's missing too).
 */
function ensureTeamDirectorySheet_() {
  var id = SCRIPT_PROPS.getProperty('TEAM_EMAILS_SPREADSHEET_ID') || TEAM_EMAILS_SPREADSHEET_DEFAULT_ID;
  var sheet = SpreadsheetApp.openById(id).getSheets()[0];
  if (sheet.getLastRow() >= 2) return sheet;

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 2).setValues([['Name', 'Purdue Email']]);
    sheet.setFrozenRows(1);
  }

  var oldTab = SpreadsheetApp.openById(getMasterListSpreadsheetId_()).getSheetByName(LEGACY_TEAM_EMAILS_TAB_NAME);
  if (oldTab && oldTab.getLastRow() >= 2) {
    var people = oldTab.getRange(2, 1, oldTab.getLastRow() - 1, 2).getValues();
    sheet.getRange(2, 1, people.length, 2).setValues(people);
    Logger.log('Copied ' + people.length + ' people into the Team Emails sheet from the master list tab.');
  }
  return sheet;
}

/** Menu/editor entry point: logs (and in the Sheet, shows) the Team Emails sheet link. */
function openTeamEmailsSheet() {
  var sheet = ensureTeamDirectorySheet_();
  var url = sheet.getParent().getUrl();
  Logger.log('Team Emails sheet: ' + url);
  try {
    SpreadsheetApp.getUi().alert('Team Emails sheet:\n' + url);
  } catch (err) {
    // No UI when run from the editor; the log line above has the link.
  }
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

  // Keyed by the Name cell's first word so "Drew Hawley" still matches Responsible = "Drew";
  // the full cell is what gets signed on drafts.
  for (var i = 1; i < values.length; i++) {
    var fullName = String(values[i][0] || '').trim();
    var email = String(values[i][1] || '').trim();
    if (fullName && email) {
      directory[fullName.split(/\s+/)[0].toLowerCase()] = { email: email, fullName: fullName };
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
  var entry = getTeamDirectoryEntry_(name);
  return entry ? entry.email : null;
}

/**
 * The name to sign drafts with -- the Team Emails Name cell as written (e.g. "Drew Hawley"),
 * falling back to the Responsible value if that person isn't in the tab.
 */
function getResponsibleDisplayName_(name) {
  var entry = getTeamDirectoryEntry_(name);
  return entry ? entry.fullName : String(name || '').trim();
}

function getTeamDirectoryEntry_(name) {
  var key = String(name || '').trim().split(/\s+/)[0].toLowerCase();
  return getTeamDirectory_()[key] || null;
}
