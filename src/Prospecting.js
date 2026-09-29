/**
 * Finds brand-new prospect companies via Apollo for categories with a reliable search
 * signal (see CATEGORY_DISCOVERY_CRITERIA in Config.js), skips anything already present
 * in that category tab, looks up one contact per new company right away (once -- the row
 * gets the Apollo search marker either way), and appends it with a blank Status and
 * Responsible. Drafting starts once a teammate puts their name in Responsible.
 */

// Front-loaded against the Apollo credit cycle (300 credits, renews 10/26): companies
// searched per day through each `until` date (inclusive). After the last tier the final
// target keeps applying -- update this for each new credit cycle. See README.
var DAILY_PROSPECT_SCHEDULE = [
  { until: '2026-10-03', target: 8 },
  { until: '2026-10-10', target: 6 },
  { until: '2026-10-25', target: 3 }
];
var MAX_DISCOVERY_PAGES_PER_RUN = 5;

function dailyProspectTarget_(date) {
  var today = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  for (var i = 0; i < DAILY_PROSPECT_SCHEDULE.length; i++) {
    if (today <= DAILY_PROSPECT_SCHEDULE[i].until) return DAILY_PROSPECT_SCHEDULE[i].target;
  }
  return DAILY_PROSPECT_SCHEDULE[DAILY_PROSPECT_SCHEDULE.length - 1].target;
}

/**
 * Splits `total` across categories; when it doesn't divide evenly, the extra slots
 * rotate by day so no category is permanently favored.
 */
function prospectQuotas_(categories, total, date) {
  var base = Math.floor(total / categories.length);
  var extra = total % categories.length;
  var offset = Math.floor(date.getTime() / 86400000) % categories.length;
  return categories.map(function (_, i) {
    return base + (((i - offset + categories.length) % categories.length) < extra ? 1 : 0);
  });
}

function runDailyProspecting() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5 * 60 * 1000)) {
    throw new Error('Outreach run still in progress after 5 minutes, prospecting skipped.');
  }

  try {
    var now = new Date();
    var dailyTarget = dailyProspectTarget_(now);

    // Prioritize finding emails for sponsors already on the list before spending any of
    // today's Apollo budget discovering brand-new companies.
    var emailsFilled = fillMissingSponsorEmails_(dailyTarget);
    logForDigest_('Email Found', emailsFilled.updated);

    var categories = Object.keys(CATEGORY_DISCOVERY_CRITERIA);
    var remainingTarget = Math.max(0, dailyTarget - emailsFilled.attempted);
    var quotas = prospectQuotas_(categories, remainingTarget, now);
    var added = [];

    categories.forEach(function (category, i) {
      if (!quotas[i]) return;
      try {
        added = added.concat(discoverNewProspects(category, quotas[i]));
      } catch (err) {
        Logger.log('Prospecting failed for ' + category + ': ' + err.message);
      }
    });

    logForDigest_('Prospect', added);
  } finally {
    lock.releaseLock();
  }
}

function getExistingCompanyNames_(sheetName) {
  var ss = SpreadsheetApp.openById(getMasterListSpreadsheetId_());
  var sheet = ss.getSheetByName(sheetName);
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var nameCol = headerIndex_(header, 'Company Name');
  var values = sheet.getDataRange().getValues();

  var names = {};
  for (var i = 1; i < values.length; i++) {
    var name = String(values[i][nameCol] || '').trim().toLowerCase();
    if (name) names[name] = true;
  }
  return names;
}

/**
 * Company names across every category tab, not just one -- Gemini can place a discovered
 * company in a different category than the one it was found under (e.g. a Local Businesses
 * find that turns out to be Women-Owned), so a single-tab check isn't enough to stop it
 * from being re-added under a different tab on a later run.
 */
function getExistingCompanyNamesAcrossAllCategories_() {
  var names = {};
  CATEGORY_SHEET_NAMES.forEach(function (sheetName) {
    Object.keys(getExistingCompanyNames_(sheetName)).forEach(function (name) {
      names[name] = true;
    });
  });
  return names;
}

function appendProspectRow_(sheetName, companyName, contact, evaluationReason) {
  var ss = SpreadsheetApp.openById(getMasterListSpreadsheetId_());
  var sheet = ss.getSheetByName(sheetName);
  var lastColumn = sheet.getLastColumn();
  var header = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var row = new Array(lastColumn).fill('');

  row[headerIndex_(header, 'Company Name')] = companyName;
  row[headerIndex_(header, 'Point of Contact')] = contact.name || '';
  row[headerIndex_(header, 'Email')] = contact.email;
  row[headerIndex_(header, 'Notes')] = 'Auto-discovered via Apollo on ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy') +
    ' -- vetted by Gemini: ' + (evaluationReason || '(no reason given)') + '. ' + apolloSearchMarker_(contact);

  sheet.appendRow(row);
}

/**
 * Apollo returns the same ranking every time, so each category remembers which results
 * page to resume from; otherwise every day would re-scan the same already-added companies.
 */
function discoveryPageKey_(category) {
  return 'PROSPECT_NEXT_PAGE_' + category.toUpperCase().replace(/[^A-Z]+/g, '_');
}

// Companies here get evaluated (and, on a good-fit result, added) before anything else on
// the same page -- a soft priority, not a filter, so a great-fit company from anywhere in
// the US still gets added once nearby candidates are exhausted for the day.
var PROSPECT_PRIORITY_STATES = ['indiana'];
var PROSPECT_PRIORITY_CITIES = ['chicago', 'indianapolis'];
var PROSPECT_PRIORITY_NEARBY_STATES = ['illinois', 'ohio', 'michigan', 'kentucky'];

/**
 * Lower score = evaluated first. Indiana itself ranks highest (covers Indianapolis too),
 * then explicitly-named nearby major cities, then neighboring states, then everywhere else.
 */
function prospectProximityScore_(org) {
  var state = String(org.state || '').trim().toLowerCase();
  var city = String(org.city || '').trim().toLowerCase();

  if (PROSPECT_PRIORITY_STATES.indexOf(state) !== -1) return 0;
  if (PROSPECT_PRIORITY_CITIES.indexOf(city) !== -1) return 1;
  if (PROSPECT_PRIORITY_NEARBY_STATES.indexOf(state) !== -1) return 2;
  return 3;
}

/**
 * Stable sort (native Array#sort in the V8 runtime Apps Script now uses) so ties keep
 * Apollo's own relevance order within a proximity tier.
 */
function sortByProspectProximity_(orgs) {
  return orgs.slice().sort(function (a, b) {
    return prospectProximityScore_(a) - prospectProximityScore_(b);
  });
}

/**
 * Pulls candidate companies from Apollo for `category`, skips anything already in any
 * category tab (case-insensitive name match), requires a real contact email, and requires
 * Gemini to sign off that the company is a plausible sponsor before it's written anywhere --
 * Gemini also has the final say on which category tab it actually belongs in (Apollo's
 * criteria are just a rough net). Appends up to `maxResults` new rows.
 * Returns [{ sponsorName, contactEmail, category }] for the rows added.
 */
function discoverNewProspects(category, maxResults) {
  maxResults = maxResults || 10;
  var criteria = CATEGORY_DISCOVERY_CRITERIA[category];
  if (!criteria) {
    throw new Error('No discovery criteria configured for category "' + category + '".');
  }

  var pageKey = discoveryPageKey_(category);
  var page = Number(SCRIPT_PROPS.getProperty(pageKey)) || 1;
  var existing = getExistingCompanyNamesAcrossAllCategories_();
  var added = [];

  for (var pagesRead = 0; added.length < maxResults && pagesRead < MAX_DISCOVERY_PAGES_PER_RUN; pagesRead++) {
    var payload = Object.assign({ page: page, per_page: 25 }, criteria);
    var result = apolloRequest_('/mixed_companies/search', payload);
    var orgs = result.organizations || result.accounts || [];
    if (!orgs.length) {
      page = 1;
      break;
    }
    orgs = sortByProspectProximity_(orgs);

    for (var i = 0; i < orgs.length && added.length < maxResults; i++) {
      var name = String(orgs[i].name || '').trim();
      if (!name || existing[name.toLowerCase()]) continue;

      var contact = null;
      try {
        contact = findContactAtOrganization_(orgs[i].id);
      } catch (err) {
        Logger.log('Contact lookup failed for ' + name + ': ' + err.message);
      }

      if (!contact || !contact.email) {
        Logger.log('Skipping ' + name + ' -- no contact email found.');
        continue;
      }

      var evaluation = evaluateSponsorProspect_(name, category);
      if (!evaluation.isGoodFit) {
        Logger.log('Skipping ' + name + ' -- Gemini flagged as not a good sponsor fit: ' + evaluation.reason);
        continue;
      }

      appendProspectRow_(evaluation.category, name, contact, evaluation.reason);
      existing[name.toLowerCase()] = true;
      added.push({ sponsorName: name, contactEmail: contact.email, category: evaluation.category });
    }

    // Only advance past a page once every company on it has been considered.
    if (i >= orgs.length) page++;
  }

  SCRIPT_PROPS.setProperty(pageKey, String(page));
  Logger.log('Added ' + added.length + ' new prospect(s) from ' + category + ' discovery: ' +
    added.map(function (a) { return a.sponsorName + ' <' + a.contactEmail + '> [' + a.category + ']'; }).join(', '));
  return added;
}

function discoverLocalBusinessProspects() {
  return discoverNewProspects('Local Businesses', 10);
}

function discoverInKindSponsorProspects() {
  return discoverNewProspects('In-Kind Sponsors', 10);
}

/**
 * Read-only preview -- logs the raw Apollo results for a category's discovery criteria
 * without touching the sheet at all. Run this after changing CATEGORY_DISCOVERY_CRITERIA
 * to sanity-check the filter actually worked before trusting discoverNewProspects().
 */
function previewDiscoveryCriteria_(category) {
  var criteria = CATEGORY_DISCOVERY_CRITERIA[category];
  var payload = Object.assign({ page: 1, per_page: 10 }, criteria);
  var result = apolloRequest_('/mixed_companies/search', payload);
  var orgs = result.organizations || result.accounts || [];

  orgs.forEach(function (org) {
    Logger.log(org.name + ' -- ' + (org.city || '') + ', ' + (org.state || '') + ' ' + (org.country || ''));
  });
  Logger.log('Total results in Apollo: ' + (result.pagination ? result.pagination.total_entries : 'unknown'));
}

function previewLocalBusinessDiscovery() {
  previewDiscoveryCriteria_('Local Businesses');
}

function previewInKindSponsorDiscovery() {
  previewDiscoveryCriteria_('In-Kind Sponsors');
}
