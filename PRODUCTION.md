# NayVella Landing production reference

- Public site: https://nayvella.com/
- Cloudflare Pages project: `nayvella-landing`, production branch `main`
- Published deployment: `ee0cf2f2-0d9a-4e53-9068-3b8ce29bdd2d`
- Deployment URL: https://ee0cf2f2.nayvella-landing.pages.dev/
- Riyadh release date: 2026-11-21
- Published source commit: `bac0fc57d70d6f95bf496994063aa794e787bb2e`
- Release tag: `production/2026-11-21-ee0cf2f2`
- Local archive: `backups/2026-11-21-ee0cf2f2/NayVella-Production-2026-11-21-ee0cf2f2.tar.gz`
- External recovery location: `Meridian Glow-MacBook Air/NayVella Production Backups/2026-11-21-ee0cf2f2`
- Previous production deployment: `2f3098e3-6ede-4950-9f6d-5434f500c5bd` (Git `65b00c2`)

The release tag identifies the exact source used to build production. This
reference document is recorded in a documentation-only commit after deployment.
The recovery archive contains the tagged source, published build, Git history
bundle and release evidence.

For future work, first compare the active Cloudflare deployment with this
reference. Validate the next approved release in a clean checkout with
`npm test` and `npm run build:production`.
