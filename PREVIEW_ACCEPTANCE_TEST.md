# Preview acceptance test

## Deployment prerequisites
- Apply `migrations/0001_create_leads.sql` to Preview D1.
- Bind Preview D1 as `DB`.
- Configure `RATE_LIMIT_SALT`.
- Configure the Turnstile public and secret keys together, or leave both disabled during an initial functional preview.

## Required checks
1. Open every URL in `sitemap.xml`; confirm HTTP 200, correct language/direction, canonical, and hreflang.
2. Run `tests/run-lighthouse.sh <preview-origin>` for Arabic and English on a throttled mobile profile. Record Performance, Accessibility, Best Practices, SEO, LCP, and CLS. INP requires interaction or field data.
3. Validate JSON-LD with Schema Markup Validator and Google Rich Results Test where the type is supported. Search appearance is not guaranteed by valid schema.
4. Test the social card after deployment using the relevant platform preview/debugging tools and WhatsApp after cache refresh.
5. Submit valid entries through the customer, merchant, clinic/doctor, and beauty-professional forms; verify exactly one D1 row per successful request, the correct segment, consent timestamp, fields, and UTM values.
6. Resubmit the same email and segment within 24 hours; verify HTTP 409 and no duplicate row.
7. Exceed eight submissions from one requester and segment within an hour; verify HTTP 429.
8. Verify rejection of missing consent, invalid email, `partial:true`, disallowed Origin, non-JSON body, and an invalid Turnstile token when Turnstile is enabled.
9. Verify logs contain event metadata but not the raw form payload, email, or raw requester address.
10. Test 390 px, 768 px, and 1440 px widths in Safari, Chrome, and Firefox. Confirm the menu, FAQ, stepped forms, location choices, and language links work without overflow or clipped content.

## Release gate
Do not promote this package from **Preview Candidate** to **Production Ready** until the Preview D1, security-negative tests, social previews, schema checks, and recorded mobile Lighthouse checks pass.
