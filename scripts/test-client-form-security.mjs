import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function client() {
  const source = await readFile(new URL('../assets/js/site.js', import.meta.url), 'utf8');
  const document = { documentElement: { lang: 'en' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const context = vm.createContext({ document, location: { search: '' }, history: {}, URLSearchParams, AbortController, setTimeout, clearTimeout,
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, requestAnimationFrame() {}, scrollTo() {} },
    fetch() { throw new Error('Client payload test must not use the network'); },
  });
  // Expose the actual private functions only inside this isolated test VM.
  const instrumented = source.replace(/\}\)\(\);\s*$/, 'globalThis.reviewPayload = buildPayload; globalThis.reviewToken = (form, token) => turnstileTokens.set(form, token);\n})();');
  vm.runInContext(instrumented, context);
  return context;
}
test('form payload excludes injected Turnstile hidden fields and unrelated controls', async () => {
  const context = await client();
  const controls = [
    { id: 'customer-email', type: 'email', value: 'review@example.invalid' },
    { id: 'customer-consent', type: 'checkbox', checked: true },
    { id: 'customer-hp', type: 'text', value: '' },
    { id: 'cf-chl-widget-review_response', type: 'hidden', value: 'must-not-be-stored-as-a-field' },
    { id: 'unrelated-field', type: 'text', value: 'must-not-be-collected' },
  ];
  const form = { querySelectorAll: () => controls };
  context.reviewToken(form, 'separate-verification-token');
  const payload = context.reviewPayload('customer', form);
  assert.equal(payload.segment, 'customer_lead'); assert.equal(payload.email, 'review@example.invalid');
  assert.equal(payload.turnstileToken, 'separate-verification-token'); assert.equal(payload.consent, true);
  assert.ok(Number.isFinite(Date.parse(payload.consentAt)));
  assert.ok(!JSON.stringify(payload).includes('must-not-'));
});
test('an unchecked consent is never converted to an affirmative consent or timestamp', async () => {
  const context = await client();
  const form = { querySelectorAll: () => [{ id: 'expert-consent', type: 'checkbox', checked: false }, { id: 'expert-name', type: 'text', value: 'Review' }] };
  const payload = context.reviewPayload('expert', form);
  assert.equal(payload.consent, false); assert.equal(payload.consentAt, undefined); assert.equal(payload.segment, 'specialist_lead');
});
