function json(body, status = 200, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
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

export async function onRequestGet({ request, env }) {
  const origin = allowedOrigin(request, env);
  if (origin === null) return json({ error: 'origin_not_allowed' }, 403);
  const fullyConfigured = Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
  return json({
    turnstileSiteKey: fullyConfigured ? env.TURNSTILE_SITE_KEY : '',
    turnstileEnabled: fullyConfigured,
  }, 200, origin);
}

export async function onRequestOptions({ request, env }) {
  const origin = allowedOrigin(request, env);
  if (origin === null) return json({ error: 'origin_not_allowed' }, 403);
  const allowOrigin = origin || new URL(request.url).origin;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}
