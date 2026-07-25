# NayVella v2.2 — Final review matrix

| Area | Completed in the package | Still requires Cloudflare Preview |
|---|---|---|
| Asset structure | Shared CSS, JavaScript, fonts, images, icons and social image are externalized | Network-cache behavior and deployed transfer sizes |
| Inline presentation | Zero HTML style attributes; JavaScript uses state classes | Browser visual regression review |
| Languages | Arabic and English routes remain separate without bilingual data attributes | Live navigation and language-switch review |
| Forms | Four forms, validation, D1 worker, duplicate control and rate limiting are implemented | Real D1 writes and negative tests |
| Turnstile | Public configuration endpoint and Siteverify path are implemented | Configure both keys and validate a real challenge |
| Social links | Dead placeholder links are removed | Add official accounts later when available |
| CSP | No unsafe-inline; JSON-LD hashes and Turnstile origins are included | Confirm response header and Turnstile behavior on Preview |
| Anti-abuse maintenance | Expired deduplication and stale rate-limit rows are cleaned | Observe D1 behavior under Preview load |
| SEO/GEO | Canonical, hreflang, sitemap, metadata, schemas, FAQ and Trust Center retained | Rich Results, Schema Validator and live crawl checks |
| Performance | HTML is reduced and reusable assets are cacheable | Lighthouse mobile, LCP, CLS and interaction measurements |
| Social preview | Open Graph/Twitter metadata and social card are present | WhatsApp, LinkedIn and X cache tests |

The package remains a **Preview Candidate** until the checks in `PREVIEW_ACCEPTANCE_TEST.md` pass.
