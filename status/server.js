const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4747;
const ENV_PATH = path.join(__dirname, '..', '.env');

function loadEnv() {
  const env = {};
  if (!fs.existsSync(ENV_PATH)) return env;

  fs.readFileSync(ENV_PATH, 'utf8').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  });

  return env;
}

async function checkApolloKey(apiKey) {
  if (!apiKey) return { present: false, valid: false, message: 'No key in .env' };

  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ q_organization_name: 'apollo-status-check', page: 1, per_page: 1 })
    });

    if (res.ok) return { present: true, valid: true, message: 'Key accepted (' + res.status + ')' };
    if (res.status === 401 || res.status === 403) {
      return { present: true, valid: false, message: 'Key rejected (' + res.status + ')' };
    }
    return { present: true, valid: false, message: 'Unexpected response (' + res.status + ')' };
  } catch (err) {
    return { present: true, valid: false, message: 'Request failed: ' + err.message };
  }
}

async function buildStatus() {
  const env = loadEnv();
  const apollo = await checkApolloKey(env.APOLLO_API_KEY);

  return {
    apollo,
    localConfig: {
      DIGEST_RECIPIENT_EMAIL: !!env.DIGEST_RECIPIENT_EMAIL,
      MASTER_LIST_SPREADSHEET_ID: !!env.MASTER_LIST_SPREADSHEET_ID,
      OUTREACH_GUIDE_DOC_ID: !!env.OUTREACH_GUIDE_DOC_ID,
      EMAIL_TEMPLATE_DOC_ID: !!env.EMAIL_TEMPLATE_DOC_ID
    },
    scriptId: env.MASTER_LIST_SPREADSHEET_ID || null
  };
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/status') {
    const status = await buildStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Status page: http://localhost:' + PORT);
});
