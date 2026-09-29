/**
 * Reads the email template Doc, extracts the section for a given category (the doc
 * has all 5 category templates plus follow-up guidelines concatenated in one file),
 * and fills in the real placeholders the guide actually uses: [COMPANY NAME]/
 * [Company Name], [Name], [Your Full Name], [morning/afternoon/evening].
 */

// Replaces every category template's own opening paragraph, so all outreach drafts
// start the same way regardless of what the template Doc says.
var STANDARD_OUTREACH_OPENER = 'My name is [Your Name], and I’m part of the team organizing InnovateHer at Purdue University. ' +
  'I’m reaching out to introduce an opportunity for [COMPANY NAME] to engage with a highly motivated and underrepresented student talent pool.';

// Replaces every category template's own subject line, so all outreach drafts use the
// same subject regardless of what the template Doc says.
var STANDARD_OUTREACH_SUBJECT = 'Strategic Partnership Opportunity with Purdue’s Leading Women-Centric Hackathon';

// Replaces the follow-up template's own subject line, so all follow-up drafts use the
// same subject regardless of what the template Doc says.
var STANDARD_FOLLOW_UP_SUBJECT = 'Follow-Up: InnovateHer 2027 Sponsorship Opportunity';

function getEmailTemplateFullText_() {
  var doc = DocumentApp.openById(getEmailTemplateDocId_());
  return doc.getBody().getText();
}

function getOutreachGuideText_() {
  var doc = DocumentApp.openById(getOutreachGuideDocId_());
  return doc.getBody().getText();
}

var outreachGuideTextCache_ = null;

/**
 * Cached for the lifetime of a single execution -- discoverNewProspects calls this once
 * per candidate company (potentially dozens per run), and re-reading the Doc that often
 * would be wasteful and slow.
 */
function getOutreachGuideTextCached_() {
  if (outreachGuideTextCache_ === null) {
    outreachGuideTextCache_ = getOutreachGuideText_();
  }
  return outreachGuideTextCache_;
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

// Fixed rather than time-of-day: drafts are created by an hourly trigger but sent whenever
// the teammate reviews them, so the creation time says nothing about when it's read.
function fillPlaceholders_(text, fields) {
  return text
    .replace(/\[morning\/afternoon\/evening\]/gi, 'afternoon')
    .replace(/\[company name\]/gi, fields.sponsorName)
    .replace(/\[name\]/gi, fields.contactFirstName)
    .replace(/\[your full name\]/gi, fields.senderName)
    .replace(/\[your name\]/gi, fields.senderName);
}

/**
 * Google Docs joins paragraphs with a single "\n" (the visual gap between paragraphs is
 * just paragraph spacing, not a blank line in the text), so plain-text emails built
 * straight from doc.getBody().getText() read as one run-on block. Insert a blank line
 * between every paragraph so the sent email actually has visible spacing.
 */
function addParagraphSpacing_(text) {
  return text.replace(/\r\n/g, '\n').split('\n').join('\n\n');
}

/**
 * Returns { subject, body }, both fully filled in and ready to send, for the given
 * category's cold-outreach template.
 */
function draftOutreachEmail(sponsorName, contactFirstName, category, senderName, notes) {
  var heading = CATEGORY_TEMPLATE_HEADINGS[category];
  if (!heading) {
    throw new Error('No email template mapped for category "' + category + '".');
  }

  var section = extractTemplateSection_(getEmailTemplateFullText_(), heading);
  var split = splitSubjectAndBody_(section);
  var fields = { sponsorName: sponsorName, contactFirstName: contactFirstName, senderName: senderName };
  var body = mapIntroParagraph_(fillPlaceholders_(split.body, fields), function () {
    return fillPlaceholders_(STANDARD_OUTREACH_OPENER, fields);
  });
  var personalization = generateBrandPersonalization_(sponsorName, category, notes, getIntroParagraph_(body));

  return {
    subject: STANDARD_OUTREACH_SUBJECT,
    body: addParagraphSpacing_(insertPersonalization_(body, personalization))
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
    subject: STANDARD_FOLLOW_UP_SUBJECT,
    body: addParagraphSpacing_(fillPlaceholders_(split.body, fields))
  };
}
