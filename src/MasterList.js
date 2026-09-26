/**
 * Reads and updates the outreach master list.
 * Schema assumptions live in Config.js (MASTER_LIST_COLUMNS) -- confirm against the real sheet.
 */

function getMasterListSheet_() {
  var ss = SpreadsheetApp.openById(getMasterListSpreadsheetId_());
  var sheet = ss.getSheetByName(MASTER_LIST_SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet tab "' + MASTER_LIST_SHEET_NAME + '" not found in the master list spreadsheet.');
  }
  return sheet;
}

/**
 * Returns rows (1-based sheet row number + parsed fields) for sponsors not yet contacted.
 */
function getUncontactedSponsors() {
  var sheet = getMasterListSheet_();
  var values = sheet.getDataRange().getValues();
  var cols = MASTER_LIST_COLUMNS;
  var results = [];

  for (var i = 1; i < values.length; i++) { // skip header row
    var row = values[i];
    var status = row[cols.STATUS];
    if (status === 'Not Contacted' || status === '') {
      results.push({
        rowNumber: i + 1,
        sponsorName: row[cols.SPONSOR_NAME],
        category: row[cols.CATEGORY],
        contactName: row[cols.CONTACT_NAME],
        contactEmail: row[cols.CONTACT_EMAIL]
      });
    }
  }
  return results;
}

/**
 * Returns rows for sponsors marked Contacted with no recorded response,
 * whose contact date is at least `minDaysAgo` days in the past.
 */
function getSponsorsAwaitingResponse(minDaysAgo) {
  var sheet = getMasterListSheet_();
  var values = sheet.getDataRange().getValues();
  var cols = MASTER_LIST_COLUMNS;
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - minDaysAgo);
  var results = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var status = row[cols.STATUS];
    var dateContacted = row[cols.DATE_CONTACTED];
    var followUpSent = row[cols.DATE_FOLLOW_UP_SENT];

    if (status === 'Contacted' && dateContacted && !followUpSent && new Date(dateContacted) <= cutoff) {
      results.push({
        rowNumber: i + 1,
        sponsorName: row[cols.SPONSOR_NAME],
        category: row[cols.CATEGORY],
        contactName: row[cols.CONTACT_NAME],
        contactEmail: row[cols.CONTACT_EMAIL],
        dateContacted: dateContacted
      });
    }
  }
  return results;
}

function markSponsorContacted(rowNumber, contactName, contactEmail) {
  var sheet = getMasterListSheet_();
  var cols = MASTER_LIST_COLUMNS;
  sheet.getRange(rowNumber, cols.CONTACT_NAME + 1).setValue(contactName);
  sheet.getRange(rowNumber, cols.CONTACT_EMAIL + 1).setValue(contactEmail);
  sheet.getRange(rowNumber, cols.STATUS + 1).setValue('Contacted');
  sheet.getRange(rowNumber, cols.DATE_CONTACTED + 1).setValue(new Date());
}

function markFollowUpSent(rowNumber) {
  var sheet = getMasterListSheet_();
  var cols = MASTER_LIST_COLUMNS;
  sheet.getRange(rowNumber, cols.DATE_FOLLOW_UP_SENT + 1).setValue(new Date());
}
