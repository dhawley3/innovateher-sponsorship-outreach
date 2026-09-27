/**
 * Optional 1-2 sentence brand personalization for outreach drafts, via the Gemini API's
 * free tier. Set GEMINI_API_KEY in Script Properties to enable it (GEMINI_MODEL optionally
 * overrides the model). Any failure returns '' so drafting falls back to the plain template.
 */

var GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
var GEMINI_MAX_PERSONALIZATION_CHARS = 450;

function generateBrandPersonalization_(sponsorName, category, notes, introParagraph) {
  var apiKey = SCRIPT_PROPS.getProperty('GEMINI_API_KEY');
  if (!apiKey) return '';

  var model = SCRIPT_PROPS.getProperty('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL;
  var prompt = [
    'You are helping a student at Purdue University write a sponsorship outreach email for InnovateHer,',
    'a 24-hour hackathon for women and gender minorities in tech. Write 1-2 sentences that will be',
    'appended to the end of the email\'s opening paragraph (shown below), personalizing it to the company.',
    '',
    'Company: ' + sponsorName,
    'Sponsor category: ' + category,
    'Team notes about this company: ' + (notes || '(none)'),
    '',
    'Opening paragraph:',
    introParagraph,
    '',
    'Rules:',
    '- Refer to something specific and well known about the company: its products, mission, or community work, and why that fits a hackathon for women and gender minorities in tech.',
    '- Only state facts you are highly confident are true. Never invent statistics, awards, programs, partnerships, or people. If you are unsure about the company, keep it general to what its name and category make clear.',
    '- Do not repeat what the opening paragraph already says, and do not describe InnovateHer.',
    '- Warm, professional tone. No greeting, sign-off, quotation marks, markdown, or em dashes.',
    '- Output only the sentences.'
  ].join('\n');

  try {
    var response = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
      {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-goog-api-key': apiKey },
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6 }
        }),
        muteHttpExceptions: true
      }
    );

    if (response.getResponseCode() !== 200) {
      Logger.log('Gemini personalization skipped for ' + sponsorName + ' (' + response.getResponseCode() + '): ' + response.getContentText().slice(0, 300));
      return '';
    }

    var data = JSON.parse(response.getContentText());
    var parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    var text = parts.map(function (p) { return p.text || ''; }).join('').trim()
      .replace(/^["'“]+|["'”]+$/g, '')
      .replace(/\s+/g, ' ');

    if (!text || text.length > GEMINI_MAX_PERSONALIZATION_CHARS) {
      Logger.log('Gemini personalization skipped for ' + sponsorName + ': empty or too long (' + text.length + ' chars).');
      return '';
    }
    return text;
  } catch (err) {
    Logger.log('Gemini personalization skipped for ' + sponsorName + ': ' + err.message);
    return '';
  }
}

/**
 * Appends the personalization to the first paragraph after the greeting line. Doc text
 * separates paragraphs with single newlines and may contain blank ones, hence the scan.
 */
function insertPersonalization_(body, personalization) {
  if (!personalization) return body;
  return mapIntroParagraph_(body, function (intro) {
    return intro.replace(/\s+$/, '') + ' ' + personalization;
  });
}

function getIntroParagraph_(body) {
  var paragraphs = body.split('\n').filter(function (l) { return l.trim(); });
  return paragraphs[1] || '';
}

/** Rewrites the first non-empty paragraph after the greeting line. */
function mapIntroParagraph_(body, fn) {
  var lines = body.split('\n');
  var nonEmptySeen = 0;
  for (var i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    nonEmptySeen++;
    if (nonEmptySeen === 2) {
      lines[i] = fn(lines[i]);
      return lines.join('\n');
    }
  }
  return body;
}

/** Manual check from the editor: logs a personalized Cheetos draft without creating anything. */
function testGeminiPersonalization() {
  var draft = draftOutreachEmail('Cheetos', 'Flavia', 'In-Kind Sponsors', getResponsibleDisplayName_('Drew'), '');
  Logger.log(draft.subject + '\n\n' + draft.body);
}
