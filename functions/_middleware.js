import { apiHeaders } from '../lib/lead-security.mjs';

export async function onRequest({ request, next }) {
  const response = await next();
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();
  const headers = new Headers(response.headers);
  if (url.pathname.startsWith('/api/')) {
    for (const [key, value] of apiHeaders()) {
      if (key !== 'content-type' && key !== 'vary') headers.set(key, value);
    }
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  if (url.protocol === 'https:' && !headers.has('Strict-Transport-Security')) headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (hostname.endsWith('.pages.dev')) headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
