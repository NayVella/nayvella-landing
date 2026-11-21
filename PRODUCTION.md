# NayVella Landing production reference

- Public site: https://nayvella.com/
- Cloudflare Pages project: `nayvella-landing`, production branch `main`
- Published deployment: `2ad01abc-2c74-40bf-b835-7cb92d2a2efb`
- Deployment URL: https://2ad01abc.nayvella-landing.pages.dev/
- Riyadh release date: 2026-11-21
- Published source commit: `d6627f7d666980ad5485917b31e91b3127a997fe`
- Release tag: `production/2026-11-21-2ad01abc`
- Local archive: `backups/2026-11-21-2ad01abc/NayVella-Production-2026-11-21-2ad01abc.tar.gz`
- External recovery location: `Meridian Glow-MacBook Air/NayVella Production Backups/2026-11-21-2ad01abc`
- Previous production deployment: `ee0cf2f2-0d9a-4e53-9068-3b8ce29bdd2d` (Git `bac0fc5`)

The release tag identifies the exact source used to build production. This
reference document is recorded in a documentation-only commit after deployment.
The recovery archive contains the tagged source, published build, Git history
bundle and release evidence.

For future work, first compare the active Cloudflare deployment with this
reference. Validate the next approved release in a clean checkout with
`npm test` and `npm run build:production`.
