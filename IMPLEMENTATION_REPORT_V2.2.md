# NayVella Landing v2.2 — Preview Candidate

This release was built cumulatively on `nayvella-landing-v2.1-production-candidate-built-on-v2.0.zip`.

## Five programmatic items completed

1. All HTML `style` attributes were converted to external CSS classes under `assets/css/site.css`; JavaScript now uses state classes instead of runtime inline styles.
2. The existing language-separated routes remain intact and no bilingual `data-ar`/`data-en` payload was reintroduced.
3. Turnstile is fully wired through a same-origin public configuration endpoint; no blank key remains in HTML.
4. Placeholder social links were removed, and the CSP is strict: no `unsafe-inline`, no inline style/script attributes, and exact JSON-LD SHA-256 hashes are listed.
5. Stale `lead_rate_limits` records older than 48 hours are deleted, alongside expired deduplication records.

## Additional correction

The malformed select attributes inherited from the prior source were repaired and replaced by a reusable `.select-input` class.

## Source SHA-256

`1b1808a2dd4d0268a81f4d6b8e1b25e43433cc8e5cb8a623603b5ec95b76467e`

## Remaining deployment validation

Cloudflare Preview is still required for Lighthouse/Core Web Vitals, real D1 writes, Turnstile challenge validation, browser testing, and social-preview validation.
