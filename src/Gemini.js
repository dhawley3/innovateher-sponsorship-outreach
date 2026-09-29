/**
 * Optional 1-2 sentence brand personalization for outreach drafts, via the Gemini API's
 * free tier. Set GEMINI_API_KEY in Script Properties to enable it (GEMINI_MODEL optionally
 * overrides the model). Any failure returns '' so drafting falls back to the plain template.
 */

var GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
var GEMINI_MAX_PERSONALIZATION_CHARS = 450;
var GEMINI_PROSPECT_EVAL_MAX_ATTEMPTS = 3;
var GEMINI_PROSPECT_EVAL_RETRY_DELAY_MS = 10 * 60 * 1000;
// Keeps the prompt (and Gemini's free-tier token usage) bounded if the guide Doc is long.
var GEMINI_MAX_GUIDE_CHARS_IN_PROMPT = 6000;

// Categories Gemini is allowed to place a newly discovered prospect into. Excludes "Warm
// Contacts" -- that tab is for people the team already knows, never a cold Apollo find.
var PROSPECT_CATEGORIES_FOR_CLASSIFICATION = ['Mass Monetary Sponsors', 'In-Kind Sponsors', 'Women-Owned', 'Local Businesses'];

/**
 * Vets a newly discovered company before it's ever written to the sheet: is it actually
 * worth asking for sponsorship, and which category tab does it really belong in (Apollo's
 * discovery criteria are just a rough net -- e.g. it has no reliable "women-owned" filter,
 * so a company found under Local Businesses might really belong under Women-Owned).
 * A transient failure (rate limit, network blip, bad JSON back) is retried up to
 * GEMINI_PROSPECT_EVAL_MAX_ATTEMPTS times, 10 minutes apart -- long enough to ride out a
 * per-minute rate limit on Gemini's free tier. A missing API key is a config problem retrying
 * can't fix, so that fails immediately instead. Note each 10-minute wait blocks this script
 * execution (Utilities.sleep), so a run that hits this path can eat a large chunk of Apps
 * Script's execution time limit -- acceptable here since prospect discovery only evaluates a
 * handful of companies per day.
 * Throws if Gemini isn't configured or every attempt fails, since this is now a required
 * quality gate rather than an optional nice-to-have -- callers should let that abort the
 * run rather than silently adding unvetted prospects.
 */
function evaluateSponsorProspect_(companyName, discoveryCategory) {
  var apiKey = SCRIPT_PROPS.getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set -- required to vet new sponsor prospects before adding them.');
  }

  var guideExcerpt = getOutreachGuideTextCached_().slice(0, GEMINI_MAX_GUIDE_CHARS_IN_PROMPT);

  var lastError;
  for (var attempt = 1; attempt <= GEMINI_PROSPECT_EVAL_MAX_ATTEMPTS; attempt++) {
    try {
      return requestSponsorEvaluation_(apiKey, companyName, discoveryCategory, guideExcerpt);
    } catch (err) {
      lastError = err;
      Logger.log('Gemini prospect evaluation attempt ' + attempt + '/' + GEMINI_PROSPECT_EVAL_MAX_ATTEMPTS +
        ' failed for ' + companyName + ': ' + err.message);
      if (attempt < GEMINI_PROSPECT_EVAL_MAX_ATTEMPTS) {
        // Utilities.sleep caps out at 5 minutes per call, so two calls make the full 10.
        Utilities.sleep(GEMINI_PROSPECT_EVAL_RETRY_DELAY_MS / 2);
        Utilities.sleep(GEMINI_PROSPECT_EVAL_RETRY_DELAY_MS / 2);
      }
    }
  }
  throw new Error('Gemini prospect evaluation failed for ' + companyName + ' after ' +
    GEMINI_PROSPECT_EVAL_MAX_ATTEMPTS + ' attempts: ' + lastError.message);
}

function requestSponsorEvaluation_(apiKey, companyName, discoveryCategory, guideExcerpt) {
  var model = SCRIPT_PROPS.getProperty('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL;
  var prompt = [
    'You are helping a student team vet potential sponsor companies for InnovateHer, a 24-hour hackathon',
    'at Purdue University for women and gender minorities in tech. Use the sponsorship outreach guide',
    'below as the source of truth for what a good sponsor looks like and how sponsors should be found.',
    '',
    '--- Outreach guide (may be truncated) ---',
    guideExcerpt,
    '--- End outreach guide ---',
    '',
    'Company: ' + companyName,
    'Category it was found under: ' + discoveryCategory,
    '',
    'Decide two things:',
    '1. Would this company plausibly be a good fit to ask for hackathon sponsorship (cash, product, or ' +
      'in-kind)? Reject it if it is clearly the wrong size or type for student-event sponsorship -- e.g. a ' +
      'huge multinational with no history of local/community sponsorship, a company in an unrelated or ' +
      'inappropriate industry, or a name that does not look like a real, identifiable business. Also reject ' +
      'it if it is not headquartered in the United States and does not have a major U.S. branch or office -- ' +
      'this hackathon only sponsors companies with a real U.S. presence.',
    '2. Which single category it actually belongs in, from exactly this list: ' +
      PROSPECT_CATEGORIES_FOR_CLASSIFICATION.join(', ') + '.',
    '   Use "Women-Owned" if the company is women-owned or women-led, regardless of which category it was',
    '   found under. Otherwise pick whichever remaining category fits best: "Mass Monetary Sponsors" for a',
    '   large company that could give a cash sponsorship, "In-Kind Sponsors" for a consumer product/brand',
    '   likely to donate product instead of cash, "Local Businesses" for a small local company.',
    '',
    'Only use facts you are confident about. If you do not recognize the company at all, or cannot confirm',
    'it has a real U.S. presence, treat that as a reason to be cautious rather than guessing.',
    '',
    'Respond with ONLY a JSON object, no markdown or code fences, in exactly this shape:',
    '{"isGoodFit": true, "category": "one of the categories above", "reason": "one short sentence"}'
  ].join('\n');

  var response = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': apiKey },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('Gemini prospect evaluation failed (' + response.getResponseCode() + '): ' +
      response.getContentText().slice(0, 300));
  }

  var data = JSON.parse(response.getContentText());
  var parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  var text = parts.map(function (p) { return p.text || ''; }).join('').trim()
    .replace(/^```(json)?/i, '').replace(/```\s*$/i, '').trim();

  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('Could not parse Gemini prospect evaluation as JSON: ' + text.slice(0, 300));
  }

  var category = PROSPECT_CATEGORIES_FOR_CLASSIFICATION.indexOf(parsed.category) !== -1
    ? parsed.category
    : discoveryCategory;

  return {
    isGoodFit: parsed.isGoodFit === true,
    category: category,
    reason: String(parsed.reason || '').trim()
  };
}

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
