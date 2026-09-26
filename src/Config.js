/**
 * Central place for Script Properties and the master list's column layout.
 * Set actual values under Project Settings -> Script Properties, never here.
 */

var SCRIPT_PROPS = PropertiesService.getScriptProperties();

function getApolloApiKey_() {
  return requireProperty_('APOLLO_API_KEY');
}

function getDigestRecipient_() {
  return requireProperty_('DIGEST_RECIPIENT_EMAIL');
}

function getMasterListSpreadsheetId_() {
  return requireProperty_('MASTER_LIST_SPREADSHEET_ID');
}

function getOutreachGuideDocId_() {
  return requireProperty_('OUTREACH_GUIDE_DOC_ID');
}

function getEmailTemplateDocId_() {
  return requireProperty_('EMAIL_TEMPLATE_DOC_ID');
}

function requireProperty_(key) {
  var value = SCRIPT_PROPS.getProperty(key);
  if (!value) {
    throw new Error('Missing Script Property "' + key + '". Set it under Project Settings -> Script Properties.');
  }
  return value;
}

/**
 * Category tabs in the master list spreadsheet that get automated outreach.
 * "Purdue Funding" is excluded on purpose -- internal grants/departments, not
 * cold sponsor outreach, and there's no matching email template for it.
 */
var CATEGORY_SHEET_NAMES = [
  'Warm Contacts',
  'Mass Monetary Sponsors',
  'In-Kind Sponsors',
  'Women-Owned',
  'Local Businesses'
];
