import { allowedOrigin, apiHeaders, cleanFields, cleanUtm, turnstileConfig } from '../../lib/lead-security.mjs';

const ALLOWED_SEGMENTS = new Set([
  'customer_lead',
  'merchant_lead',
  'clinic_lead',
  'specialist_lead',
]);
const REQUIRED_FIELDS = {
  customer_lead: ['email'],
  merchant_lead: ['brand', 'contact', 'email', 'mobile'],
  clinic_lead: ['name', 'contact', 'email', 'mobile'],
  specialist_lead: ['name', 'email', 'mobile'],
};
const FORM_ATTRIBUTION = {
  '/ar/customers/': { submissionLanguage: 'ar', segment: 'customer_lead' },
  '/en/customers/': { submissionLanguage: 'en', segment: 'customer_lead' },
  '/ar/merchants/': { submissionLanguage: 'ar', segment: 'merchant_lead' },
  '/en/merchants/': { submissionLanguage: 'en', segment: 'merchant_lead' },
  '/ar/clinics-doctors/': { submissionLanguage: 'ar', segment: 'clinic_lead' },
  '/en/clinics-doctors/': { submissionLanguage: 'en', segment: 'clinic_lead' },
  '/ar/beauty-experts/': { submissionLanguage: 'ar', segment: 'specialist_lead' },
  '/en/beauty-experts/': { submissionLanguage: 'en', segment: 'specialist_lead' },
};
const MAX_BODY_BYTES = 20_000;
const RATE_LIMIT_MAX = 8;

function json(body, status = 200, origin = '') {
  return new Response(JSON.stringify(body), { status, headers: apiHeaders(origin) });
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
}

function validMobile(value) {
  return /^(05\d{8}|\+9665\d{8})$/.test((value || '').replace(/[\s-]/g, ''));
}

function hasRequiredFields(segment, fields) {
  return REQUIRED_FIELDS[segment].every((field) => (
    typeof fields[field] === 'string' && fields[field].trim()
  ));
}

function requestAttribution(request, segment) {
  const referrer = request.headers.get('Referer') || '';
  if (!referrer) return null;
  try {
    const referrerUrl = new URL(referrer);
    if (referrerUrl.origin !== new URL(request.url).origin) return null;
    const sourcePath = `${referrerUrl.pathname.replace(/\/+$/, '')}/`;
    const attribution = FORM_ATTRIBUTION[sourcePath];
    if (!attribution || attribution.segment !== segment) return null;
    return { ...attribution, sourcePath };
  } catch {
    return null;
  }
}

function log(event, request, details = {}) {
  console.log(JSON.stringify({
    service: 'nayvella-leads',
    event,
    at: new Date().toISOString(),
    requestId: request.headers.get('CF-Ray') || crypto.randomUUID(),
    ...details,
  }));
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyTurnstile(token, secret, ip, expectedHostnames, allowTestKeys) {
  if (!secret || !token) return false;
  const normalizedToken = String(token).trim();
  const isPreviewTestToken = normalizedToken === 'XXXX.DUMMY.TOKEN.XXXX';
  const hasValidProductionShape = /^[A-Za-z0-9._-]{20,2048}$/.test(normalizedToken);
  if (isPreviewTestToken && !allowTestKeys) return false;
  if (!isPreviewTestToken && !hasValidProductionShape) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', normalizedToken);
  if (ip) form.append('remoteip', ip);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const result = await response.json();
    if (!result.success) return false;
    const allowedHostnames = expectedHostnames
      .split(',')
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean);
    return (allowTestKeys && isPreviewTestToken) || allowedHostnames.includes(String(result.hostname || '').toLowerCase());
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequestOptions({ request, env }) {
  const origin = allowedOrigin(request, env);
  if (origin === null) return json({ error: 'origin_not_allowed' }, 403);
  const allowOrigin = origin || new URL(request.url).origin;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}

export async function onRequestPost({ request, env }) {
  const origin = allowedOrigin(request, env);
  if (origin === null || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    log('blocked_origin', request);
    return json({ error: 'origin_not_allowed' }, 403);
  }
  if (!env.DB) {
    log('configuration_error', request, { component: 'DB' });
    return json({ error: 'server_configuration_error' }, 500, origin);
  }
  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (contentType !== 'application/json') return json({ error: 'unsupported_media_type' }, 415, origin);
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413, origin);

  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'invalid_json' }, 400, origin);
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return json({ error: 'payload_too_large' }, 413, origin);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return json({ error: 'invalid_json' }, 400, origin);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'invalid_payload' }, 400, origin);
  const { segment, partial, hp, consent, consentAt, utm, turnstileToken, ...submittedFields } = body;
  if (hp) return json({ ok: true }, 200, origin);
  if (!ALLOWED_SEGMENTS.has(segment)) return json({ error: 'invalid_segment' }, 400, origin);
  const attribution = requestAttribution(request, segment);
  if (!attribution) return json({ error: 'invalid_attribution' }, 400, origin);
  if (partial) return json({ error: 'partial_submission_not_allowed' }, 400, origin);
  if (consent !== true) return json({ error: 'consent_required' }, 400, origin);
  const fields = cleanFields(segment, submittedFields);
  const attributionTags = cleanUtm(utm);
  if (!fields || !attributionTags) return json({ error: 'invalid_fields' }, 400, origin);
  if (!hasRequiredFields(segment, fields)) return json({ error: 'missing_required_fields' }, 400, origin);

  const email = (fields.email || '').trim().toLowerCase();
  if (!validEmail(email)) return json({ error: 'invalid_email' }, 400, origin);
  if (segment !== 'customer_lead' && !validMobile(fields.mobile)) {
    return json({ error: 'invalid_mobile' }, 400, origin);
  }
  const config = turnstileConfig(request, env);
  if (!config.enabled) return json({ error: 'server_configuration_error' }, 503, origin);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await verifyTurnstile(
    turnstileToken,
    config.secret,
    ip,
    config.expectedHostnames,
    config.allowTestKeys
  ))) {
    log('turnstile_failed', request, { segment });
    return json({ error: 'turnstile_failed' }, 400, origin);
  }

  try {
    const salt = env.RATE_LIMIT_SALT || config.secret;
    if (!salt) {
      log('configuration_error', request, { component: 'RATE_LIMIT_SALT' });
      return json({ error: 'server_configuration_error' }, 500, origin);
    }

    // Indexed, bounded maintenance prevents anti-abuse tables from growing indefinitely.
    await env.DB.prepare(`DELETE FROM lead_dedup WHERE expires_at <= datetime('now')`).run();
    await env.DB.prepare(`DELETE FROM lead_rate_limits WHERE updated_at < datetime('now', '-48 hours')`).run();

    const clientHash = await sha256(`${salt}:${ip}:${segment}`);
    const windowStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();

    await env.DB.prepare(`
      INSERT INTO lead_rate_limits(client_hash, segment, window_start, request_count, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'))
      ON CONFLICT(client_hash, segment, window_start)
      DO UPDATE SET request_count = request_count + 1, updated_at = datetime('now')
    `).bind(clientHash, segment, windowStart).run();

    const rate = await env.DB.prepare(`
      SELECT request_count FROM lead_rate_limits
      WHERE client_hash = ? AND segment = ? AND window_start = ?
    `).bind(clientHash, segment, windowStart).first();
    if (Number(rate?.request_count || 0) > RATE_LIMIT_MAX) {
      log('rate_limited', request, { segment });
      return json({ error: 'rate_limited' }, 429, origin);
    }

    const dedupeHash = await sha256(`${salt}:${email}:${segment}`);
    const claim = await env.DB.prepare(`
      INSERT OR IGNORE INTO lead_dedup(dedupe_hash, expires_at, created_at)
      VALUES (?, datetime('now', '+24 hours'), datetime('now'))
    `).bind(dedupeHash).run();
    if (Number(claim?.meta?.changes || 0) !== 1) {
      log('duplicate_blocked', request, { segment });
      return json({ error: 'duplicate_submission' }, 409, origin);
    }

    try {
      await env.DB.prepare(`
        INSERT INTO nayvella_leads(
          segment, email, consent, consent_at, payload, utm,
          submission_language, source_path, created_at
        )
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        segment,
        email,
        new Date().toISOString(),
        JSON.stringify(fields),
        JSON.stringify(attributionTags),
        attribution.submissionLanguage,
        attribution.sourcePath
      ).run();
    } catch (insertError) {
      await env.DB.prepare(`DELETE FROM lead_dedup WHERE dedupe_hash = ?`).bind(dedupeHash).run();
      throw insertError;
    }

    log('lead_created', request, { segment });
    return json({ ok: true }, 201, origin);
  } catch (error) {
    log('db_error', request, { segment, code: error?.name || 'error' });
    return json({ error: 'server_error' }, 500, origin);
  }
}

export async function onRequestGet({ request, env }) {
  const origin = allowedOrigin(request, env);
  const response = json({ error: 'method_not_allowed' }, 405, origin === null ? '' : origin);
  response.headers.set('Allow', 'POST, OPTIONS');
  return response;
}
