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
    muteHttpExceptions: true
  });

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
function apolloFindOrganization(sponsorName) {
  var result = apolloRequest_('/mixed_companies/search', {
    q_organization_name: sponsorName,
    page: 1,
    per_page: 1
  });
  var orgs = result.organizations || result.accounts || [];
  return orgs.length ? orgs[0] : null;
}

/**
 * Searches for people at an organization matching one of the target job-title categories
 * (e.g. partnerships, marketing, community relations).
 */
function apolloFindPeopleAtOrganization(organizationId, titleKeywords) {
  var result = apolloRequest_('/mixed_people/search', {
    organization_ids: [organizationId],
    person_titles: titleKeywords,
    page: 1,
    per_page: 5
  });
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
