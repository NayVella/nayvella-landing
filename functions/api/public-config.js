import { allowedOrigin, apiHeaders, turnstileConfig } from '../../lib/lead-security.mjs';

function json(body, status = 200, origin = '') {
  return new Response(JSON.stringify(body), { status, headers: apiHeaders(origin) });
}

export async function onRequestGet({ request, env }) {
  const origin = allowedOrigin(request, env);
  if (origin === null) return json({ error: 'origin_not_allowed' }, 403);
  const config = turnstileConfig(request, env);
  const fullyConfigured = config.enabled;
  return json({
    turnstileSiteKey: fullyConfigured ? config.siteKey : '',
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
