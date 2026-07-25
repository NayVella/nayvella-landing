# NayVella v2.2 launch checklist

## Preview infrastructure
- [ ] Deploy this package to a Cloudflare Pages Preview branch.
- [ ] Apply `migrations/0001_create_leads.sql` to Preview D1.
- [ ] Bind Preview D1 as `DB`.
- [ ] Configure a strong `RATE_LIMIT_SALT` secret.
- [ ] Configure the Turnstile public and secret keys together, or keep both disabled during the first functional preview.

## Functional acceptance
- [ ] Arabic and English navigation and language-switch links work.
- [ ] Mobile menu, FAQ, same-page scroll, yes/no controls, expert locations and two-step forms work.
- [ ] Customer lead reaches D1 once.
- [ ] Merchant lead reaches D1 once.
- [ ] Clinic/doctor lead reaches D1 once.
- [ ] Beauty-professional lead reaches D1 once.
- [ ] Consent timestamp, segment, UTM and stored payload are correct.
- [ ] Partial submissions create no row.
- [ ] Duplicate email + segment within 24 hours returns 409 and creates no second row.
- [ ] More than eight requests per requester/segment/hour returns 429.

## Search, GEO and social
- [ ] Every sitemap URL returns 200 on Preview.
- [ ] Canonical and hreflang resolve correctly.
- [ ] Google Rich Results Test / Schema Markup Validator completed where applicable.
- [ ] Mobile Lighthouse reports saved for Arabic and English.
- [ ] WhatsApp, LinkedIn and X/social preview checked after cache refresh.

## Browser and release approval
- [ ] 390 px, 768 px and 1440 px tested.
- [ ] Safari, Chrome and Firefox tested.
- [ ] Privacy, terms and Trust Center text approved for publication.
- [ ] Production D1 migration/binding confirmed.
- [ ] Production deployment approved in writing.
- [ ] Search Console sitemap resubmitted after production deployment.
