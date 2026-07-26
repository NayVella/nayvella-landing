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
const MAX_BODY_BYTES = 20_000;
const RATE_LIMIT_MAX = 8;

function json(body, status = 200, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return '';
  const requestOrigin = new URL(request.url).origin;
  const configured = (env.SITE_ORIGIN || '').replace(/\/$/, '');
  return origin === requestOrigin || (configured && origin === configured) ? origin : null;
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

async function verifyTurnstile(token, secret, ip, expectedHostnames = '') {
  if (!secret || !token) return false;
  const normalizedToken = String(token).trim();
  const isPreviewTestToken = normalizedToken === 'XXXX.DUMMY.TOKEN.XXXX';
  const hasValidProductionShape = /^[A-Za-z0-9._-]{20,2048}$/.test(normalizedToken);
  if (!isPreviewTestToken && !hasValidProductionShape) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', normalizedToken);
  if (ip) form.append('remoteip', ip);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) return false;
    const result = await response.json();
    if (!result.success) return false;
    const allowedHostnames = expectedHostnames
      .split(',')
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean);
    return !allowedHostnames.length || allowedHostnames.includes(String(result.hostname || '').toLowerCase());
  } catch {
    return false;
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
  if (origin === null) {
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
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413, origin);
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400, origin);
  }

  const { segment, partial, hp, consent, consentAt, utm, turnstileToken, ...fields } = body || {};
  if (hp) return json({ ok: true }, 200, origin);
  if (!ALLOWED_SEGMENTS.has(segment)) return json({ error: 'invalid_segment' }, 400, origin);
  if (partial) return json({ error: 'partial_submission_not_allowed' }, 400, origin);
  if (consent !== true) return json({ error: 'consent_required' }, 400, origin);
  if (!hasRequiredFields(segment, fields)) return json({ error: 'missing_required_fields' }, 400, origin);

  const email = (fields.email || '').trim().toLowerCase();
  if (!validEmail(email)) return json({ error: 'invalid_email' }, 400, origin);
  if (segment !== 'customer_lead' && !validMobile(fields.mobile)) {
    return json({ error: 'invalid_mobile' }, 400, origin);
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await verifyTurnstile(
    turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    ip,
    env.TURNSTILE_EXPECTED_HOSTNAMES
  ))) {
    log('turnstile_failed', request, { segment });
    return json({ error: 'turnstile_failed' }, 400, origin);
  }

  try {
    const salt = env.RATE_LIMIT_SALT || env.TURNSTILE_SECRET_KEY;
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
        INSERT INTO nayvella_leads(segment, email, consent, consent_at, payload, utm, created_at)
        VALUES (?, ?, 1, ?, ?, ?, datetime('now'))
      `).bind(
        segment,
        email,
        consentAt || new Date().toISOString(),
        JSON.stringify(fields),
        JSON.stringify(utm || {})
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
  return json({ error: 'method_not_allowed' }, 405, origin === null ? '' : origin);
}
