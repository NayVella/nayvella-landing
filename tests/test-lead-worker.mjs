import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/lead.js';

class MockDB {
  constructor() {
    this.leads = [];
    this.rates = new Map();
    this.dedup = new Set();
  }
  prepare(sql) {
    const db = this;
    const normalized = sql.replace(/\s+/g, ' ').trim();
    return {
      bind(...args) {
        return statement(args);
      },
      ...statement([]),
    };
    function statement(args) {
      return {
        async run() {
          if (normalized.startsWith('INSERT INTO lead_rate_limits')) {
            const [hash, segment, window] = args;
            const key = `${hash}|${segment}|${window}`;
            db.rates.set(key, (db.rates.get(key) || 0) + 1);
            return { success: true, meta: { changes: 1 } };
          }
          if (normalized.startsWith("DELETE FROM lead_dedup WHERE expires_at") || normalized.startsWith("DELETE FROM lead_rate_limits WHERE updated_at")) {
            return { success: true, meta: { changes: 0 } };
          }
          if (normalized.startsWith('INSERT OR IGNORE INTO lead_dedup')) {
            const [hash] = args;
            if (db.dedup.has(hash)) return { success: true, meta: { changes: 0 } };
            db.dedup.add(hash);
            return { success: true, meta: { changes: 1 } };
          }
          if (normalized.startsWith('DELETE FROM lead_dedup WHERE dedupe_hash')) {
            db.dedup.delete(args[0]);
            return { success: true, meta: { changes: 1 } };
          }
          if (normalized.startsWith('INSERT INTO nayvella_leads')) {
            const [segment, email, consentAt, payload, utm] = args;
            db.leads.push({ id: db.leads.length + 1, segment, email, consentAt, payload, utm, created_at: new Date().toISOString() });
            return { success: true, meta: { changes: 1 } };
          }
          throw new Error(`Unexpected run SQL: ${normalized}`);
        },
        async first() {
          if (normalized.startsWith('SELECT request_count FROM lead_rate_limits')) {
            const [hash, segment, window] = args;
            return { request_count: db.rates.get(`${hash}|${segment}|${window}`) || 0 };
          }
          throw new Error(`Unexpected first SQL: ${normalized}`);
        },
      };
    }
  }
}

const origin = 'https://preview.example.pages.dev';
const validBody = {
  segment: 'customer_lead',
  partial: false,
  hp: '',
  consent: true,
  consentAt: '2026-07-25T00:00:00.000Z',
  utm: { utm_source: 'test' },
  email: 'person@example.com',
};

function request(body, options = {}) {
  return new Request(`${origin}/api/lead`, {
    method: 'POST',
    headers: {
      Origin: options.origin ?? origin,
      'Content-Type': options.contentType ?? 'application/json',
      'CF-Connecting-IP': options.ip ?? '203.0.113.10',
      'CF-Ray': 'test-ray',
    },
    body: options.raw ?? JSON.stringify(body),
  });
}

async function call(db, body, options = {}) {
  const response = await onRequestPost({
    request: request(body, options),
    env: { DB: db, RATE_LIMIT_SALT: 'test-salt', SITE_ORIGIN: 'https://nayvella.com' },
  });
  return { response, json: await response.json() };
}

const db = new MockDB();
let result = await call(db, validBody);
assert.equal(result.response.status, 201);
assert.equal(result.json.ok, true);
assert.equal(db.leads.length, 1);

result = await call(db, validBody);
assert.equal(result.response.status, 409);
assert.equal(result.json.error, 'duplicate_submission');
assert.equal(db.leads.length, 1);

result = await call(new MockDB(), { ...validBody, partial: true });
assert.equal(result.response.status, 400);
assert.equal(result.json.error, 'partial_submission_not_allowed');

result = await call(new MockDB(), { ...validBody, consent: false });
assert.equal(result.response.status, 400);
assert.equal(result.json.error, 'consent_required');

result = await call(new MockDB(), { ...validBody, email: 'bad' });
assert.equal(result.response.status, 400);
assert.equal(result.json.error, 'invalid_email');

result = await call(new MockDB(), validBody, { origin: 'https://evil.example' });
assert.equal(result.response.status, 403);
assert.equal(result.json.error, 'origin_not_allowed');

result = await call(new MockDB(), validBody, { contentType: 'text/plain' });
assert.equal(result.response.status, 415);
assert.equal(result.json.error, 'unsupported_media_type');

const rateDb = new MockDB();
for (let i = 0; i < 8; i += 1) {
  result = await call(rateDb, { ...validBody, email: `person${i}@example.com` });
  assert.equal(result.response.status, 201);
}
result = await call(rateDb, { ...validBody, email: 'ninth@example.com' });
assert.equal(result.response.status, 429);
assert.equal(result.json.error, 'rate_limited');

console.log(JSON.stringify({ scenarios_passed: 8, rate_test_leads_created: rateDb.leads.length }));
