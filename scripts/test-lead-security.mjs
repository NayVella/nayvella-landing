import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, onRequestGet } from '../functions/api/lead.js';
import { onRequestGet as publicConfig } from '../functions/api/public-config.js';
import { onRequest as middleware } from '../functions/_middleware.js';
import { mock } from 'node:test';

// All submissions use an isolated in-memory test double. No live D1 or network.
const TOKEN = 'unit-token-valid-shape-01234567890123456789';
const originalFetch = globalThis.fetch;
const originalLog = console.log;
afterEach(() => { mock.restoreAll(); globalThis.fetch = originalFetch; console.log = originalLog; });
function database() {
  const state = { leads: [], dedup: new Set(), rates: new Map(), calls: [], failInsert: false };
  return { state, prepare(sql) {
    let args = [];
    const stmt = { bind(...values) { args = values; return stmt; },
      async run() {
        state.calls.push({ sql, args });
        if (/INSERT INTO lead_rate_limits/.test(sql)) { const k = args.join('|'); state.rates.set(k, (state.rates.get(k) || 0) + 1); }
        if (/INSERT OR IGNORE INTO lead_dedup/.test(sql)) {
          if (state.dedup.has(args[0])) return { meta: { changes: 0 } };
          state.dedup.add(args[0]);
        }
        if (/DELETE FROM lead_dedup WHERE dedupe_hash/.test(sql)) state.dedup.delete(args[0]);
        if (/INSERT INTO nayvella_leads/.test(sql)) {
          if (state.failInsert) throw new Error('isolated_insert_failure');
          state.leads.push(args);
        }
        return { meta: { changes: 1 } };
      },
      async first() { return { request_count: state.rates.get(args.join('|')) || 0 }; },
    };
    return stmt;
  } };
}
function setup(result = { success: true, hostname: 'nayvella.com' }) {
  mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  });
  mock.method(console, 'log', () => {});
  return { DB: database(), TURNSTILE_SITE_KEY: 'unit-site-key', TURNSTILE_SECRET_KEY: 'unit-secret-not-a-real-key', RATE_LIMIT_SALT: 'unit-salt' };
}
function payload(extra = {}) { return { segment: 'customer_lead', email: 'review@example.invalid', consent: true, turnstileToken: TOKEN, ...extra }; }
function request(body = payload(), headers = {}, url = 'https://nayvella.com/api/lead') {
  return new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: new URL(url).origin, Referer: new URL('/ar/customers/', url).href, 'CF-Connecting-IP': '203.0.113.9', ...headers }, body: JSON.stringify(body) });
}
async function expectError(req, env, status, error) {
  const response = await onRequestPost({ request: req, env });
  assert.equal(response.status, status); assert.equal((await response.json()).error, error);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  return response;
}
test('valid lead uses server consent time, normalized values and bound parameters', async () => {
  const env = setup();
  const response = await onRequestPost({ request: request(payload({ name: "Review <script>literal</script>", email: ' REVIEW@EXAMPLE.INVALID ', consentAt: '1900-01-01', utm: { utm_source: 'review' } })), env });
  assert.equal(response.status, 201); assert.equal(env.DB.state.leads.length, 1);
  const row = env.DB.state.leads[0];
  assert.equal(row[1], 'review@example.invalid'); assert.notEqual(row[2], '1900-01-01');
  assert.ok(Number.isFinite(Date.parse(row[2])));
  assert.equal(JSON.parse(row[3]).name, 'Review <script>literal</script>');
  assert.equal(row[5], 'ar'); assert.equal(row[6], '/ar/customers/');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://nayvella.com');
  assert.ok(env.DB.state.calls.every(c => !c.sql.includes('review@example.invalid')));
});
test('cross-origin and browser cross-site requests never reach storage', async () => {
  const env = setup();
  await expectError(request(payload(), { Origin: 'https://attacker.invalid' }), env, 403, 'origin_not_allowed');
  await expectError(request(payload(), { 'Sec-Fetch-Site': 'cross-site' }), env, 403, 'origin_not_allowed');
  assert.equal(env.DB.state.calls.length, 0);
});
test('attribution must match the same-origin route and segment', async () => {
  const env = setup();
  for (const ref of ['', 'https://attacker.invalid/ar/customers/', 'https://nayvella.com/ar/merchants/']) {
    await expectError(request(payload(), { Referer: ref }), env, 400, 'invalid_attribution');
  }
  assert.equal(env.DB.state.calls.length, 0);
});
test('consent, required fields, partial requests and structured payloads fail closed', async () => {
  const env = setup();
  await expectError(request(payload({ consent: false })), env, 400, 'consent_required');
  await expectError(request(payload({ partial: true })), env, 400, 'partial_submission_not_allowed');
  await expectError(request(payload({ email: '' })), env, 400, 'missing_required_fields');
  await expectError(request([]), env, 400, 'invalid_payload');
  await expectError(request(payload({ email: { value: 'bad' } })), env, 400, 'invalid_fields');
  assert.equal(env.DB.state.calls.length, 0);
});
test('unknown fields, overlong values, control characters and arbitrary attribution tags are rejected', async () => {
  const env = setup();
  for (const patch of [{ medicalRecord: 'not collected' }, { name: 'a'.repeat(161) }, { name: 'bad\u0000value' }, { utm: { hidden: 'not collected' } }, { utm: [] }]) {
    await expectError(request(payload(patch)), env, 400, 'invalid_fields');
  }
  assert.equal(env.DB.state.calls.length, 0);
});
test('body size budget rejects both Content-Length and streamed oversized UTF-8 input', async () => {
  const env = setup();
  await expectError(request(payload(), { 'Content-Length': '20001' }), env, 413, 'payload_too_large');
  await expectError(request(payload({ name: 'ب'.repeat(11000) })), env, 413, 'payload_too_large');
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(20001)); }, cancel() { cancelled = true; } });
  const req = new Request('https://nayvella.com/api/lead', { method: 'POST', headers: { Origin: 'https://nayvella.com', 'Content-Type': 'application/json' }, body, duplex: 'half' });
  await expectError(req, env, 413, 'payload_too_large'); assert.equal(cancelled, true);
  assert.equal(env.DB.state.calls.length, 0);
});
test('malformed JSON and unsupported content types do not reach storage', async () => {
  const env = setup();
  const req = new Request('https://nayvella.com/api/lead', { method: 'POST', headers: { Origin: 'https://nayvella.com', 'Content-Type': 'application/json' }, body: '{broken' });
  await expectError(req, env, 400, 'invalid_json');
  await expectError(request(payload(), { 'Content-Type': 'text/plain' }), env, 415, 'unsupported_media_type');
});
test('a successful token from another hostname is rejected even without hostname configuration', async () => {
  const env = setup({ success: true, hostname: 'other.invalid' });
  await expectError(request(), env, 400, 'turnstile_failed'); assert.equal(env.DB.state.calls.length, 0);
});
test('a missing or failed Turnstile response cannot create a lead', async () => {
  const env = setup({ success: false });
  await expectError(request(), env, 400, 'turnstile_failed');
  await expectError(request(payload({ turnstileToken: '' })), env, 400, 'turnstile_failed');
  assert.equal(env.DB.state.leads.length, 0);
});
test('a verification network failure is handled without exposing details or storing data', async () => {
  const env = setup(); mock.method(globalThis, 'fetch', async () => { throw new Error('network failure'); });
  await expectError(request(), env, 400, 'turnstile_failed'); assert.equal(env.DB.state.calls.length, 0);
});
test('public configuration fails closed when bindings are missing and never exposes the secret', async () => {
  const env = setup(); env.DB = undefined;
  const response = await publicConfig({ request: new Request('https://nayvella.com/api/public-config'), env });
  const body = await response.json(); assert.equal(body.turnstileEnabled, false); assert.equal(body.turnstileSiteKey, '');
  assert.ok(!JSON.stringify(body).includes(env.TURNSTILE_SECRET_KEY));
});
test('published Turnstile testing keys are forbidden on the public production domain', async () => {
  const env = setup(); env.TURNSTILE_SITE_KEY = '1x00000000000000000000AA'; env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA'; env.ALLOW_TURNSTILE_TEST_KEYS = 'true';
  await expectError(request(payload({ turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' })), env, 503, 'server_configuration_error');
  const response = await publicConfig({ request: new Request('https://nayvella.com/api/public-config'), env });
  assert.equal((await response.json()).turnstileEnabled, false);
});
test('preview test keys require an explicit preview-only opt-in', async () => {
  const env = setup({ success: true, hostname: 'localhost' });
  env.TURNSTILE_SITE_KEY = '1x00000000000000000000AA'; env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
  const req = () => request(payload({ turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' }), {}, 'https://review.pages.dev/api/lead');
  await expectError(req(), env, 503, 'server_configuration_error');
  env.ALLOW_TURNSTILE_TEST_KEYS = 'true';
  assert.equal((await onRequestPost({ request: req(), env })).status, 201);
});
test('duplicate claims and hourly rate limits are enforced', async () => {
  const env = setup();
  assert.equal((await onRequestPost({ request: request(), env })).status, 201);
  await expectError(request(), env, 409, 'duplicate_submission');
  for (let i = 2; i < 8; i++) assert.equal((await onRequestPost({ request: request(payload({ email: `review${i}@example.invalid` })), env })).status, 201);
  await expectError(request(payload({ email: 'rate-limited@example.invalid' })), env, 429, 'rate_limited');
  assert.equal(env.DB.state.leads.length, 7);
});
test('failed insertion releases the duplicate claim for a safe retry', async () => {
  const env = setup(); env.DB.state.failInsert = true;
  await expectError(request(), env, 500, 'server_error'); assert.equal(env.DB.state.dedup.size, 0);
  env.DB.state.failInsert = false; assert.equal((await onRequestPost({ request: request(), env })).status, 201);
});
test('all four form segments accept their allowed fields and route attribution', async () => {
  const env = setup();
  for (const [segment, page, fields] of [['customer_lead', 'customers', { name: 'Review', interest: 'Skincare' }], ['merchant_lead', 'merchants', { brand: 'Review', contact: 'Review', mobile: '0500000000', hascr: 'yes', online: 'no' }], ['clinic_lead', 'clinics-doctors', { name: 'Review', contact: 'Review', mobile: '0500000000', branches: '1' }], ['specialist_lead', 'beauty-experts', { name: 'Review', mobile: '0500000000', locations: 'Online' }]]) {
    const response = await onRequestPost({ request: request(payload({ ...fields, segment }), { Referer: `https://nayvella.com/en/${page}/` }), env });
    assert.equal(response.status, 201, segment);
  }
  assert.ok(env.DB.state.leads.every(row => row[5] === 'en'));
});
test('method rejection advertises allowed methods and secure response headers', async () => {
  const response = await onRequestGet({ request: new Request('https://nayvella.com/api/lead'), env: {} });
  assert.equal(response.status, 405); assert.equal(response.headers.get('Allow'), 'POST, OPTIONS');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
});
test('middleware secures API errors and OPTIONS without replacing static CSP hashes', async () => {
  const secure = await middleware({ request: new Request('https://nayvella.com/api/missing'), next: async () => new Response('{}', { status: 404 }) });
  assert.equal(secure.headers.get('Cache-Control'), 'no-store'); assert.equal(secure.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.ok(secure.headers.get('Content-Security-Policy').includes("default-src 'none'"));
  const policy = "script-src 'self' 'sha256-static-document-hash'";
  const page = await middleware({ request: new Request('https://review.pages.dev/ar/'), next: async () => new Response('page', { headers: { 'Content-Security-Policy': policy } }) });
  assert.equal(page.headers.get('Content-Security-Policy'), policy); assert.equal(page.headers.get('X-Robots-Tag'), 'noindex, nofollow');
});
test('operational logs do not contain submitted contact information or verification tokens', async () => {
  const env = setup();
  await onRequestPost({ request: request(payload({ name: 'Private review name' })), env });
  const logs = console.log.mock.calls.map(call => call.arguments.join(' ')).join('\n');
  assert.ok(logs.includes('lead_created'));
  for (const value of ['review@example.invalid', 'Private review name', TOKEN, env.TURNSTILE_SECRET_KEY]) assert.ok(!logs.includes(value));
});
