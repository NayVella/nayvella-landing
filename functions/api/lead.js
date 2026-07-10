// Cloudflare Pages Function — handles POST /api/lead
// Requires a D1 database bound to this project as "DB" (see setup instructions).

const ALLOWED_SEGMENTS = new Set([
  'customer_lead',
  'merchant_lead',
  'clinic_lead',
  'specialist_lead',
]);

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  body = body || {};

  const { segment, partial, hp, consent, consentAt, utm, ...fields } = body;

  // Honeypot field — if a bot filled it, pretend success and store nothing.
  if (hp) {
    return json({ ok: true }, 200);
  }

  if (!segment || !ALLOWED_SEGMENTS.has(segment)) {
    return json({ error: 'invalid_segment' }, 400);
  }

  const email = (fields.email || '').trim();
  const isPartial = !!partial;

  // Full submissions require consent and a valid email before we store anything.
  if (!isPartial) {
    if (!consent) {
      return json({ error: 'consent_required' }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: 'invalid_email' }, 400);
    }
  }

  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS nayvella_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        segment TEXT NOT NULL,
        is_partial INTEGER NOT NULL DEFAULT 0,
        email TEXT,
        consent INTEGER NOT NULL DEFAULT 0,
        consent_at TEXT,
        payload TEXT NOT NULL,
        utm TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    await env.DB.prepare(`
      INSERT INTO nayvella_leads
        (segment, is_partial, email, consent, consent_at, payload, utm)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      segment,
      isPartial ? 1 : 0,
      email || null,
      consent ? 1 : 0,
      consent ? (consentAt || new Date().toISOString()) : null,
      JSON.stringify(fields),
      JSON.stringify(utm || {})
    ).run();

    return json({ ok: true }, 200);
  } catch (err) {
    return json({ error: 'server_error' }, 500);
  }
}

// Any method other than POST is not allowed on this endpoint.
export async function onRequestGet() {
  return json({ error: 'method_not_allowed' }, 405);
}
