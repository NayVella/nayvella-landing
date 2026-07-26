import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inlineScript = indexSource.match(/<\/script><script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inlineScript, 'inline frontend script must exist');
new Function(inlineScript);

const stepFunction = indexSource.match(
  /function wireSteppedForm\(formName, step1Fields\)\{([\s\S]*?)\n  \}\n  wireSteppedForm\('merchant'/
)?.[1];

assert.ok(stepFunction, 'merchant/clinic step handler must exist');
assert.doesNotMatch(stepFunction, /sendLead|fetch\(|\/api\/lead/, 'step one must perform no network submission');
assert.match(stepFunction, /step1\.style\.display='none'; step2\.style\.display='block'/);
assert.equal(
  (indexSource.match(/sendLead\(buildPayload\(formName, form\)\)/g) || []).length,
  1,
  'lead submission must occur only in the final form-submit path'
);

const workerSource = fs.readFileSync(new URL('../functions/api/lead.js', import.meta.url), 'utf8');
const workerUrl = `data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`;
const { onRequestPost } = await import(workerUrl);

class MockDB {
  constructor() {
    this.rows = [];
  }

  prepare(sql) {
    const db = this;
    return {
      bind(...values) {
        return {
          async run() {
            if (sql.includes('INSERT INTO nayvella_leads')) {
              db.rows.push(values);
            }
            return { success: true };
          },
        };
      },
      async run() {
        return { success: true };
      },
    };
  }
}

async function submit(db, body) {
  const request = new Request('https://nayvella.com/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const response = await onRequestPost({ request, env: { DB: db } });
  return {
    status: response.status,
    body: await response.json(),
  };
}

const validBySegment = {
  customer_lead: {
    segment: 'customer_lead',
    partial: false,
    consent: true,
    email: 'customer@example.test',
  },
  merchant_lead: {
    segment: 'merchant_lead',
    partial: false,
    consent: true,
    brand: 'Test Brand',
    contact: 'Test Contact',
    email: 'merchant@example.test',
    mobile: '0500000000',
  },
  clinic_lead: {
    segment: 'clinic_lead',
    partial: false,
    consent: true,
    name: 'Test Clinic',
    contact: 'Test Contact',
    email: 'clinic@example.test',
    mobile: '0500000000',
  },
  specialist_lead: {
    segment: 'specialist_lead',
    partial: false,
    consent: true,
    name: 'Test Expert',
    email: 'expert@example.test',
    mobile: '0500000000',
  },
};

let db = new MockDB();
let result = await submit(db, { ...validBySegment.merchant_lead, partial: true });
assert.equal(result.status, 400);
assert.equal(result.body.error, 'partial_submission_not_allowed');
assert.equal(db.rows.length, 0);

db = new MockDB();
result = await submit(db, { ...validBySegment.clinic_lead, consent: false });
assert.equal(result.status, 400);
assert.equal(result.body.error, 'consent_required');
assert.equal(db.rows.length, 0);

db = new MockDB();
const missingConsent = { ...validBySegment.customer_lead };
delete missingConsent.consent;
result = await submit(db, missingConsent);
assert.equal(result.status, 400);
assert.equal(result.body.error, 'consent_required');
assert.equal(db.rows.length, 0);

const requiredFieldBySegment = {
  customer_lead: 'email',
  merchant_lead: 'brand',
  clinic_lead: 'name',
  specialist_lead: 'name',
};
for (const [segment, field] of Object.entries(requiredFieldBySegment)) {
  db = new MockDB();
  const missingRequired = { ...validBySegment[segment] };
  delete missingRequired[field];
  result = await submit(db, missingRequired);
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'missing_required_fields');
  assert.equal(db.rows.length, 0);
}

db = new MockDB();
result = await submit(db, { ...validBySegment.specialist_lead, mobile: 'invalid' });
assert.equal(result.status, 400);
assert.equal(result.body.error, 'invalid_mobile');
assert.equal(db.rows.length, 0);

const completeDb = new MockDB();
for (const body of Object.values(validBySegment)) {
  result = await submit(completeDb, body);
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
}
assert.equal(completeDb.rows.length, 4, 'all complete consented lead types must be stored');
assert.ok(completeDb.rows.every((row) => row[1] === 0 && row[3] === 1));

db = new MockDB();
result = await submit(db, { hp: 'filled-by-bot' });
assert.equal(result.status, 200);
assert.equal(result.body.ok, true);
assert.equal(db.rows.length, 0, 'honeypot submissions must be ignored');

console.log(JSON.stringify({
  test_groups_passed: 8,
  complete_consented_segments_stored: completeDb.rows.length,
}));
