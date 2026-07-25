# NayVella v2.2 — Cloudflare security and D1 setup

## Preview environment

1. Create or select the Preview D1 database.
2. Apply `migrations/0001_create_leads.sql` once.
3. Bind the database to the Pages project using the binding name `DB`.
4. Set `SITE_ORIGIN` to the approved origin for the environment.
5. Set a long random secret in `RATE_LIMIT_SALT`.

The application stores a one-way hash derived from the requester address, the salt, and the lead segment for rate limiting. It does not store the raw requester address in the application tables or structured logs.

## Cloudflare Turnstile

Configure both variables together:

- `TURNSTILE_SITE_KEY`: public site key.
- `TURNSTILE_SECRET_KEY`: server-side secret key.

The HTML contains no key placeholder. The browser requests `/api/public-config`, which returns the public key only when both variables are present. The lead worker validates each submitted token with Siteverify whenever the secret is configured.

For an initial functional Preview without Turnstile, leave both variables unset. Do not configure only one of them.

## Content Security Policy

The `_headers` file enforces:

- no `unsafe-inline` in `script-src` or `style-src`;
- `script-src-attr 'none'` and `style-src-attr 'none'`;
- same-origin executable assets;
- Cloudflare Turnstile scripts and frames;
- exact SHA-256 hashes for the 18 JSON-LD blocks;
- denial of framing, objects, camera, microphone, geolocation, payment and USB permissions.

All legacy HTML style attributes were converted to classes in `assets/css/site.css`, and `assets/js/site.js` now uses CSS state classes instead of writing runtime style attributes.

## Anti-abuse data maintenance

During lead submissions, indexed cleanup removes:

- expired rows from `lead_dedup`;
- `lead_rate_limits` rows whose `updated_at` value is older than 48 hours.

The cleanup prevents the anti-abuse tables from growing indefinitely during normal operation.

## Required Preview checks

- Submit all four lead forms and confirm rows appear in D1.
- Confirm invalid, missing and expired Turnstile tokens are rejected when Turnstile is enabled.
- Confirm duplicate email/category submissions are rejected for 24 hours.
- Confirm the ninth submission from the same client hash and segment in one hour is rate limited.
- Confirm logs contain event metadata only and not raw form payloads, email addresses or requester addresses.
