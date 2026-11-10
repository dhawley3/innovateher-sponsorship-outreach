/**
 * Thin wrapper around the three Apollo.io endpoints the API key is scoped to:
 * mixed_companies/search, mixed_people/api_search, people/match.
 */

var APOLLO_BASE_URL = 'https://api.apollo.io/v1';

function apolloRequest_(path, payload) {
  var response = UrlFetchApp.fetch(APOLLO_BASE_URL + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': getApolloApiKey_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true});

  var code = response.getResponseCode();
  if (code >= 300) {
    throw new Error('Apollo API error (' + code + ') on ' + path + ': ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}

/**
 * Finds a sponsor's organization record by name, used to get its Apollo organization_id
 * before searching for people there.
 */
function apolloFindOrganization(sponsorName) { var direct = apolloSearchOrganization_(sponsorName); if (direct) return direct; var cleaned = cleanOrganizationName_(sponsorName); if (!cleaned || cleaned.toLowerCase() === String(sponsorName || '').trim().toLowerCase()) return null; return apolloSearchOrganization_(cleaned); }

function apolloSearchOrganization_(name) { if (!name) return null; var result = apolloRequest_('/mixed_companies/search', { q_organization_name: name, page: 1, per_page: 1 }); var orgs = result.organizations || result.accounts || []; return orgs.length ? orgs[0] : null; }

var ORGANIZATION_NAME_SUFFIXES_ = [' maps', ' inc.', ' inc', ' llc.', ' llc', ' group', ' corp.', ' corp', ' corporation', ' company', ' co.', ' co', '.com'];

function cleanOrganizationName_(name) { var cleaned = String(name || '').trim(); var changed = true; while (changed) { changed = false; var lower = cleaned.toLowerCase(); for (var i = 0; i < ORGANIZATION_NAME_SUFFIXES_.length; i++) { var suffix = ORGANIZATION_NAME_SUFFIXES_[i]; if (lower.length > suffix.length && lower.slice(-suffix.length) === suffix) { cleaned = cleaned.slice(0, cleaned.length - suffix.length).trim(); changed = true; break; } } } return cleaned; }
/**
 * Searches for people at an organization matching one of the target job-title categories
 * (e.g. partnerships, marketing, community relations).
 */
function apolloFindPeopleAtOrganization(organizationId, titleKeywords) {
  var payload = { organization_ids: [organizationId], page: 1, per_page: 25 };
  if (titleKeywords && titleKeywords.length) payload.person_titles = titleKeywords;
  var result = apolloRequest_('/mixed_people/api_search', payload);
  return result.people || [];
}

/**
 * Enriches a single person record to reveal their verified email address.
 * Costs an Apollo credit per call.
 */
function apolloEnrichPerson(personId) {
  var result = apolloRequest_('/people/match', {
    id: personId,
    reveal_personal_emails: false
  });
  return result.person || null;
}
