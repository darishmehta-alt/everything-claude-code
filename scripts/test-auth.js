'use strict';
const assert = require('assert');

// test parseTokenResponse
let { parseTokenResponse, buildCredentialsJson } = require('./ecc-auth');

const raw = 'access_token=gho_abc&token_type=bearer&scope=read%3Auser';
const parsed = parseTokenResponse(raw);
assert.strictEqual(parsed.access_token, 'gho_abc');
assert.strictEqual(parsed.token_type, 'bearer');
assert.strictEqual(parsed.scope, 'read:user');
console.log('✓ parseTokenResponse');

// test buildCredentialsJson
const creds = buildCredentialsJson({ access_token: 'gho_abc', token_type: 'bearer', scope: 'read:user' }, 'testuser');
const obj = JSON.parse(creds);
assert.strictEqual(obj.access_token, 'gho_abc');
assert.strictEqual(obj.github_login, 'testuser');
assert.strictEqual(obj.token_type, 'bearer');
assert.ok(obj.stored_at, 'stored_at should be set');

// verify stored_at is valid ISO date
assert.ok(!isNaN(Date.parse(obj.stored_at)), 'stored_at should be valid date');
console.log('✓ buildCredentialsJson');

console.log('All tests passed');
