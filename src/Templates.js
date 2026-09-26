/**
 * Reads the email template Doc, extracts the section for a given category (the doc
 * has all 5 category templates plus follow-up guidelines concatenated in one file),
 * and fills in the real placeholders the guide actually uses: [COMPANY NAME]/
 * [Company Name], [Name], [Your Full Name], [morning/afternoon/evening].
 */

function getEmailTemplateFullText_() {
  var doc = DocumentApp.openById(getEmailTemplateDocId_());
  return doc.getBody().getText();
}

function getOutreachGuideText_() {
  var doc = DocumentApp.openById(getOutreachGuideDocId_());
  return doc.getBody().getText();
}

/**
 * Slices out just the text between `heading` and whichever known heading comes next,
 * so a category's draft only ever contains that category's own template.
 */
function extractTemplateSection_(fullText, heading) {
  var startIndex = fullText.indexOf(heading);
  if (startIndex === -1) {
    throw new Error('Could not find template section "' + heading + '" in the Email Template Doc.');
  }
  var contentStart = startIndex + heading.length;

  var endIndex = fullText.length;
  ALL_TEMPLATE_HEADINGS_IN_DOC_ORDER.forEach(function (otherHeading) {
    if (otherHeading === heading) return;
    var otherIndex = fullText.indexOf(otherHeading, contentStart);
    if (otherIndex !== -1 && otherIndex < endIndex) {
      endIndex = otherIndex;
    }
  });

  return fullText.slice(contentStart, endIndex).trim();
}

/**
 * The template sections list one or two lines starting with "Subject:" before the
 * actual email body -- takes the last one as the real subject (some sections have a
 * leftover draft subject line above the final one) and returns the rest as the body.
 */
function splitSubjectAndBody_(sectionText) {
  var lines = sectionText.split('\n');
  var lastSubjectLine = -1;

  for (var i = 0; i < lines.length; i++) {
    if (/^subject:/i.test(lines[i].trim())) {
      lastSubjectLine = i;
    }
  }

  if (lastSubjectLine === -1) {
    return { subject: '', body: sectionText.trim() };
  }

  var subject = lines[lastSubjectLine].replace(/^subject:/i, '').trim();
  var body = lines.slice(lastSubjectLine + 1).join('\n').trim();
  return { subject: subject, body: body };
}

function greetingForTimeOfDay_() {
  var hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function fillPlaceholders_(text, fields) {
  return text
    .replace(/\[morning\/afternoon\/evening\]/gi, greetingForTimeOfDay_())
    .replace(/\[company name\]/gi, fields.sponsorName)
    .replace(/\[name\]/gi, fields.contactFirstName)
    .replace(/\[your full name\]/gi, fields.senderName);
}

/**
 * Returns { subject, body }, both fully filled in and ready to send, for the given
 * category's cold-outreach template.
 */
function draftOutreachEmail(sponsorName, contactFirstName, category, senderName) {
  var heading = CATEGORY_TEMPLATE_HEADINGS[category];
  if (!heading) {
    throw new Error('No email template mapped for category "' + category + '".');
  }

  var section = extractTemplateSection_(getEmailTemplateFullText_(), heading);
  var split = splitSubjectAndBody_(section);
  var fields = { sponsorName: sponsorName, contactFirstName: contactFirstName, senderName: senderName };

  return {
    subject: fillPlaceholders_(split.subject, fields) || ('Partnership opportunity with InnovateHer'),
    body: fillPlaceholders_(split.body, fields)
  };
}

/**
 * Returns { subject, body } for the first (10-day) follow-up template. The guide also
 * has a 2nd/20-day follow-up, not yet wired up since the master list only tracks one
 * Follow-Up Date per row.
 */
function draftFollowUpEmail(sponsorName, contactFirstName, senderName) {
  var section = extractTemplateSection_(getEmailTemplateFullText_(), FOLLOW_UP_TEMPLATE_HEADING);
  var split = splitSubjectAndBody_(section);
  var fields = { sponsorName: sponsorName, contactFirstName: contactFirstName, senderName: senderName };

  return {
    subject: fillPlaceholders_(split.subject, fields) || 'Following up: partnership opportunity with InnovateHer',
    body: fillPlaceholders_(split.body, fields)
  };
}
