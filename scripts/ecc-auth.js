'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CREDENTIALS_PATH = path.join(os.homedir(), '.config', 'ecc2', 'credentials.json');
const GITHUB_HOSTNAME = 'github.com';

function parseTokenResponse(body) {
  return Object.fromEntries(new URLSearchParams(body));
}

function buildCredentialsJson(token, githubLogin) {
  return JSON.stringify({
    access_token: token.access_token,
    token_type: token.token_type,
    scope: token.scope,
    github_login: githubLogin,
    stored_at: new Date().toISOString(),
  }, null, 2);
}

function httpsPost(hostname, urlPath, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let buf = '';
      res.on('data', (d) => { buf += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getGithubLogin(token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/user',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'everything-claude-code',
        'Accept': 'application/json',
      },
    }, (res) => {
      let buf = '';
      res.on('data', (d) => { buf += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(buf).login || 'unknown'); } catch { resolve('unknown'); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function login() {
  const clientId = process.env.ECC_GITHUB_CLIENT_ID;
  if (!clientId) {
    console.error('Error: ECC_GITHUB_CLIENT_ID env var not set.\nCreate a GitHub OAuth App with Device Flow enabled at https://github.com/settings/developers');
    process.exit(1);
  }

  const deviceRes = await httpsPost(
    GITHUB_HOSTNAME,
    '/login/device/code',
    `client_id=${encodeURIComponent(clientId)}&scope=read%3Auser`
  );

  let deviceData;
  try {
    deviceData = JSON.parse(deviceRes.body);
  } catch {
    console.error('Unexpected response from GitHub:', deviceRes.body);
    process.exit(1);
  }

  const { device_code, user_code, verification_uri, interval = 5, expires_in = 900 } = deviceData;

  if (!device_code) {
    console.error('GitHub returned error:', deviceData.error_description || deviceData.error || deviceRes.body);
    process.exit(1);
  }

  console.log(`\nOpen in browser: ${verification_uri}`);
  console.log(`Enter code:      ${user_code}\n`);
  console.log('Waiting for authorization...');

  const deadline = Date.now() + expires_in * 1000;
  let pollInterval = interval;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollInterval * 1000));
    const pollRes = await httpsPost(
      GITHUB_HOSTNAME,
      '/login/oauth/access_token',
      `client_id=${encodeURIComponent(clientId)}&device_code=${encodeURIComponent(device_code)}&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code`
    );

    let pollData;
    try {
      pollData = JSON.parse(pollRes.body);
    } catch {
      continue;
    }

    if (pollData.error === 'authorization_pending') continue;
    if (pollData.error === 'slow_down') { pollInterval += 5; continue; }
    if (pollData.error) {
      console.error(`Auth failed: ${pollData.error_description || pollData.error}`);
      process.exit(1);
    }
    if (pollData.access_token) {
      const githubLogin = await getGithubLogin(pollData.access_token);
      fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true });
      fs.writeFileSync(CREDENTIALS_PATH, buildCredentialsJson(pollData, githubLogin), { mode: 0o600 });
      console.log(`\nLogged in as ${githubLogin}`);
      console.log(`Credentials saved to ${CREDENTIALS_PATH}`);
      return;
    }
  }

  console.error('Timed out waiting for GitHub authorization.');
  process.exit(1);
}

function logout() {
  if (fs.existsSync(CREDENTIALS_PATH)) {
    fs.unlinkSync(CREDENTIALS_PATH);
    console.log('Logged out. Credentials removed.');
  } else {
    console.log('Not logged in.');
  }
}

function whoami() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.log('Not logged in. Run: ecc login');
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  } catch {
    console.error('Credentials file corrupt. Run: ecc login');
    return;
  }
  console.log(`Logged in as: ${data.github_login}`);
  console.log(`Scope:        ${data.scope}`);
  console.log(`Stored at:    ${data.stored_at}`);
}

module.exports = { parseTokenResponse, buildCredentialsJson, login, logout, whoami, CREDENTIALS_PATH };

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'login') login().catch((e) => { console.error(e.message); process.exit(1); });
  else if (cmd === 'logout') logout();
  else if (cmd === 'whoami') whoami();
  else {
    console.error('Usage: node ecc-auth.js [login|logout|whoami]');
    process.exit(1);
  }
}
