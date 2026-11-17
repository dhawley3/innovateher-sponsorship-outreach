/**
 * Stable "launcher" web app URL so a teammate's authorization link never goes stale.
 *
 * The raw authorization URLs from authorizeGmailDraftsForTeammate() / authorizeOutlookForTeammate()
 * embed a short-lived state token -- fine for testing it yourself immediately, but if it sits
 * unread in a text thread for a while it can come back "state expired" or "Error 400:
 * invalid_request" (the long state string is also easy to mangle in transit through some
 * messaging apps). This endpoint instead mints a FRESH authorization URL on every visit and
 * immediately hands the visitor a link to it, so the thing you actually send someone -- this
 * web app's URL -- never expires.
 *
 * Deploy via Deploy -> New deployment -> Web app (Execute as: Me, Who has access: Anyone),
 * then share ONE link per person, no matter what email provider they use:
 *   <web app URL>?person=ruchira
 * That page offers whichever of Gmail / Outlook /Microsoft they still need to authorize --
 * they pick whichever one matches their actual inbox, so there's nothing for Drew to know or
 * guess about a teammate's email provider ahead of time. (`&service=gmail` or `&service=outlook`
 * still works too, jumping straight to one provider, kept for any link sent out before this.)
 * Someone whose email is neither Gmail nor Outlook/Microsoft can't get real drafts in their own
 * Drafts folder (there's no OAuth flow for it), but saveDraftForReview() already falls back to
 * emailing them a copy automatically -- no setup needed on their end for that to work.
 *
 * NOTE: Apps Script allows exactly one global doGet() per project -- HealthCheck.js used to
 * also define one (for its own `?token=...` status-check endpoint), which silently won
 * depending on file push order and swallowed every request this launcher ever got (always
 * returning HealthCheck's own `{"error":"unauthorized"}`, regardless of what this file did).
 * The single real doGet() below dispatches by which query param is present instead.
 */
function doGet(e) {
  var hasPerson = !!(e && e.parameter && e.parameter.person);
  return hasPerson ? authLauncherDoGet_(e) : healthCheckDoGet(e);
}

function authLauncherDoGet_(e) {
  var person = String((e && e.parameter && e.parameter.person) || '').trim().toLowerCase();
  var requestedService = String((e && e.parameter && e.parameter.service) || '').trim().toLowerCase();

  if (!person) {
    return HtmlService.createHtmlOutput('Missing "person" parameter, e.g. ?person=ruchira.');
  }
  if (requestedService && requestedService !== 'gmail' && requestedService !== 'outlook') {
    return HtmlService.createHtmlOutput('"service" must be "gmail" or "outlook".');
  }

  var options = [];
  if (!requestedService || requestedService === 'gmail') {
    options.push(buildAuthOption_(person, 'gmail', 'Gmail', getGmailDraftsServiceFor_(person), 'PENDING_GMAIL_DRAFTS_AUTH_PERSON'));
  }
  if (!requestedService || requestedService === 'outlook') {
    options.push(buildAuthOption_(person, 'outlook', 'Outlook / Microsoft', getMsGraphServiceFor_(person), 'PENDING_GRAPH_AUTH_PERSON'));
  }

  if (options.every(function (o) { return o.alreadyAuthorized; })) {
    return HtmlService.createHtmlOutput(escapeHtml_(person) + ' has already authorized ' +
      options.map(function (o) { return o.label; }).join(' and ') + ' -- nothing more to do.');
  }

  var buttonsHtml = options.map(function (o) {
    if (o.alreadyAuthorized) {
      return '<p>' + o.label + ': already authorized.</p>';
    }
    return '<p><a href="' + o.authUrl + '" style="font-size: 1.2em;">Authorize ' + o.label + '</a></p>';
  }).join('');

  var instructions = options.length > 1
    ? '<p>Pick whichever matches the email you actually use -- it will create real drafts in your own Drafts folder from now on.</p>'
    : '<p>Sign in with your own ' + options[0].label + ' account to let drafts land in your own Drafts folder.</p>';

  return HtmlService.createHtmlOutput(
    '<html><body style="font-family: sans-serif; text-align: center; margin-top: 15%;">' +
    '<h2>InnovateHer Sponsorship Outreach</h2>' +
    instructions +
    buttonsHtml +
    '</body></html>'
  );
}

/**
 * Checks one provider's auth state for a person and, if they're not yet authorized, marks
 * that provider's pending-auth Script Property and mints a fresh authorization URL. The two
 * providers' pending properties are independent, so offering both at once (when the launcher
 * link didn't pin a specific service) is safe -- whichever link the person actually clicks is
 * the one that matters.
 */
function buildAuthOption_(person, service, label, oauthService, pendingPropertyName) {
  if (oauthService.hasAccess()) {
    return { service: service, label: label, alreadyAuthorized: true };
  }
  PropertiesService.getScriptProperties().setProperty(pendingPropertyName, person);
  return { service: service, label: label, alreadyAuthorized: false, authUrl: oauthService.getAuthorizationUrl() };
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
