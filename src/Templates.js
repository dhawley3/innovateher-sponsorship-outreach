/**
 * Reads the outreach guide and email template Docs from Drive and fills in placeholders.
 * Template placeholders use {{FieldName}} syntax, e.g. {{SponsorName}}, {{ContactFirstName}}.
 */

function getEmailTemplateText_() {
  var doc = DocumentApp.openById(getEmailTemplateDocId_());
  return doc.getBody().getText();
}

function getOutreachGuideText_() {
  var doc = DocumentApp.openById(getOutreachGuideDocId_());
  return doc.getBody().getText();
}

/**
 * fields: { SponsorName, ContactFirstName, Category, ... }
 */
function fillTemplate_(templateText, fields) {
  var result = templateText;
  Object.keys(fields).forEach(function (key) {
    var pattern = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
    result = result.replace(pattern, fields[key] || '');
  });
  return result;
}

function draftOutreachEmailBody(sponsorName, contactFirstName, category) {
  var template = getEmailTemplateText_();
  return fillTemplate_(template, {
    SponsorName: sponsorName,
    ContactFirstName: contactFirstName,
    Category: category
  });
}

function draftFollowUpEmailBody(sponsorName, contactFirstName, category) {
  // TODO: confirm whether the follow-up uses a distinct template section, or the
  // same Doc with a "Follow-up" heading. For now this reuses the main template.
  var template = getEmailTemplateText_();
  return fillTemplate_(template, {
    SponsorName: sponsorName,
    ContactFirstName: contactFirstName,
    Category: category
  });
}
