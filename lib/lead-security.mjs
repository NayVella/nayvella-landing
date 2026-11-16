// Server-only helpers: this directory is not copied to the public build.
export const FIELD_LIMITS = {
  customer_lead: { name: 160, email: 254, interest: 120 },
  merchant_lead: { brand: 180, contact: 160, email: 254, mobile: 32, city: 120, biztype: 120, category: 120, hascr: 24, online: 24, productcount: 64, social: 500, notes: 2000 },
  clinic_lead: { entitytype: 120, name: 180, contact: 160, email: 254, mobile: 32, city: 120, specialty: 180, licensestatus: 120, services: 500, website: 500, branches: 64, notes: 2000 },
  specialist_lead: { name: 160, specialty: 180, experience: 80, locations: 200, email: 254, mobile: 32, city: 120, portfolio: 500, license: 120, notes: 2000 },
};
const TEST_SITE_KEYS = new Set(['1x00000000000000000000AA', '2x00000000000000000000AB', '1x00000000000000000000BB', '2x00000000000000000000BB', '3x00000000000000000000FF']);
const TEST_SECRET_KEYS = new Set(['1x0000000000000000000000000000000AA', '2x0000000000000000000000000000000AA', '3x0000000000000000000000000000000AA']);
export function turnstileConfig(request, env) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const siteKey = String(env.TURNSTILE_SITE_KEY || '').trim();
  const secret = String(env.TURNSTILE_SECRET_KEY || '').trim();
  const preview = ['localhost', '127.0.0.1', '[::1]'].includes(hostname) || hostname.endsWith('.pages.dev');
  const allowTestKeys = preview && env.ALLOW_TURNSTILE_TEST_KEYS === 'true';
  const testKeys = TEST_SITE_KEYS.has(siteKey) || TEST_SECRET_KEYS.has(secret);
  return { siteKey, secret, allowTestKeys, enabled: Boolean(env.DB && siteKey && secret && (!testKeys || allowTestKeys)), expectedHostnames: String(env.TURNSTILE_EXPECTED_HOSTNAMES || hostname) };
}
export function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return '';
  const configured = String(env.SITE_ORIGIN || '').replace(/\/$/, '');
  return origin === new URL(request.url).origin || (configured && origin === configured) ? origin : null;
}
export function cleanFields(segment, fields) {
  const limits = FIELD_LIMITS[segment];
  if (!limits || !fields || typeof fields !== 'object' || Array.isArray(fields)) return null;
  const cleaned = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!Object.hasOwn(limits, key) || typeof value !== 'string' || value.length > limits[key] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null;
    cleaned[key] = value.trim();
  }
  return cleaned;
}
export function cleanUtm(utm) {
  if (utm === undefined) return {};
  if (!utm || typeof utm !== 'object' || Array.isArray(utm)) return null;
  const result = {};
  for (const [key, value] of Object.entries(utm)) {
    if (!['utm_source', 'utm_medium', 'utm_campaign'].includes(key) || typeof value !== 'string' || value.length > 180) return null;
    result[key] = value.trim();
  }
  return result;
}
export function apiHeaders(origin = '') {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY', 'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}
