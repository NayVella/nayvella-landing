import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/public-config.js';

const url = 'https://preview.example.pages.dev/api/public-config';
let response = await onRequestGet({
  request: new Request(url, { headers: { Origin: 'https://preview.example.pages.dev' } }),
  env: { TURNSTILE_SITE_KEY: 'site-key', TURNSTILE_SECRET_KEY: 'secret-key' },
});
let body = await response.json();
assert.equal(response.status, 200);
assert.equal(body.turnstileEnabled, true);
assert.equal(body.turnstileSiteKey, 'site-key');

response = await onRequestGet({
  request: new Request(url, { headers: { Origin: 'https://preview.example.pages.dev' } }),
  env: { TURNSTILE_SITE_KEY: 'site-key' },
});
body = await response.json();
assert.equal(body.turnstileEnabled, false);
assert.equal(body.turnstileSiteKey, '');

response = await onRequestGet({
  request: new Request(url, { headers: { Origin: 'https://evil.example' } }),
  env: { TURNSTILE_SITE_KEY: 'site-key', TURNSTILE_SECRET_KEY: 'secret-key' },
});
assert.equal(response.status, 403);

console.log(JSON.stringify({ public_config_scenarios_passed: 3 }));
