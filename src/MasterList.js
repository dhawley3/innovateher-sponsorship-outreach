/**
 * Reads and updates the outreach master list across its category tabs (CATEGORY_SHEET_NAMES).
 * Columns are looked up by header text rather than fixed index, because "Mass Monetary
 * Sponsors" has an extra "First Contacted Date" column the other tabs don't.
 */

function getCategorySheets_() {
  var ss = SpreadsheetApp.openById(getMasterListSpreadsheetId_());
  return CATEGORY_SHEET_NAMES.map(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      throw new Error('Sheet tab "' + name + '" not found in the master list spreadsheet.');
    }
    return { name: name, sheet: sheet };
  });
}

function headerIndex_(headerRow, columnName) {
  for (var i = 0; i < headerRow.length; i++) {
    if (String(headerRow[i]).trim().toLowerCase() === columnName.toLowerCase()) {
      return i;
    }
  }
  throw new Error('Column "' + columnName + '" not found in header row: ' + headerRow.join(', '));
}

/**
 * Every contact email already appearing anywhere in the master list with a non-blank
 * Status or Last Contact -- i.e. someone has already reached out to them, regardless
 * of which category tab or row that happened in. Used to stop the same person from
 * getting a second, independent outreach draft.
 */
function getAlreadyContactedEmails_() {
  var emails = {};

  getCategorySheets_().forEach(function (entry) {
    var values = entry.sheet.getDataRange().getValues();
    var header = values[0];
    var emailCol = headerIndex_(header, 'Email');
    var statusCol = headerIndex_(header, 'Status');
    var lastContactCol = headerIndex_(header, 'Last Contact');

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var email = String(row[emailCol] || '').trim().toLowerCase();
      if (email && (row[statusCol] || row[lastContactCol])) {
        emails[email] = true;
      }
    }
  });

  return emails;
}

/**
 * Returns rows (by category tab + row number) for sponsors not yet contacted:
 * blank status or "Brainstormed", and not already contacted elsewhere under a
 * different row/tab.
 */
function getUncontactedSponsors() {
  var alreadyContacted = getAlreadyContactedEmails_();
  var results = [];

  getCategorySheets_().forEach(function (entry) {
    var values = entry.sheet.getDataRange().getValues();
    var header = values[0];
    var emailCol = headerIndex_(header, 'Email');
    var statusCol = headerIndex_(header, 'Status');
    var responsibleCol = headerIndex_(header, 'Responsible');
    var pocCol = headerIndex_(header, 'Point of Contact');

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var status = row[statusCol];
      var email = String(row[emailCol] || '').trim();

      if ((status === '' || status === 'Brainstormed') &&
          !(email && alreadyContacted[email.toLowerCase()])) {
        results.push({
          sheetName: entry.name,
          rowNumber: i + 1,
          category: entry.name,
          sponsorName: row[0],
          contactName: row[pocCol],
          contactEmail: email,
          responsible: row[responsibleCol]
        });
      }
    }
  });

  return results;
}

/**
 * Returns rows for sponsors marked Contacted with no recorded follow-up yet,
 * whose Last Contact date is at least `minDaysAgo` days in the past.
 */
function getSponsorsAwaitingResponse(minDaysAgo) {
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - minDaysAgo);
  var results = [];

  getCategorySheets_().forEach(function (entry) {
    var values = entry.sheet.getDataRange().getValues();
    var header = values[0];
    var emailCol = headerIndex_(header, 'Email');
    var statusCol = headerIndex_(header, 'Status');
    var responsibleCol = headerIndex_(header, 'Responsible');
    var pocCol = headerIndex_(header, 'Point of Contact');
    var lastContactCol = headerIndex_(header, 'Last Contact');
    var followUpCol = headerIndex_(header, 'Follow-Up Date');

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var status = row[statusCol];
      var dateContacted = row[lastContactCol];
      var followUpSent = row[followUpCol];

      if (status === 'Contacted' && dateContacted && !followUpSent && new Date(dateContacted) <= cutoff) {
        results.push({
          sheetName: entry.name,
          rowNumber: i + 1,
          category: entry.name,
          sponsorName: row[0],
          contactName: row[pocCol],
          contactEmail: row[emailCol],
          responsible: row[responsibleCol],
          dateContacted: dateContacted
        });
      }
    }
  });

  return results;
}

function markSponsorContacted(sheetName, rowNumber, contactName, contactEmail) {
  var ss = SpreadsheetApp.openById(getMasterListSpreadsheetId_());
  var sheet = ss.getSheetByName(sheetName);
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  sheet.getRange(rowNumber, headerIndex_(header, 'Point of Contact') + 1).setValue(contactName);
  sheet.getRange(rowNumber, headerIndex_(header, 'Email') + 1).setValue(contactEmail);
  sheet.getRange(rowNumber, headerIndex_(header, 'Status') + 1).setValue('Contacted');
  sheet.getRange(rowNumber, headerIndex_(header, 'Last Contact') + 1).setValue(new Date());
}

function markFollowUpSent(sheetName, rowNumber) {
  var ss = SpreadsheetApp.openById(getMasterListSpreadsheetId_());
  var sheet = ss.getSheetByName(sheetName);
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  sheet.getRange(rowNumber, headerIndex_(header, 'Follow-Up Date') + 1).setValue(new Date());
}
