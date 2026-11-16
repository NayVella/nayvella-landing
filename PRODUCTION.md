# NayVella Landing production reference

- Public site: https://nayvella.com/
- Cloudflare Pages project: `nayvella-landing`, production branch `main`
- Published deployment: `2f3098e3-6ede-4950-9f6d-5434f500c5bd`
- Deployment URL: https://2f3098e3.nayvella-landing.pages.dev/
- Riyadh release date: 2026-11-16
- Local release tag: `production/2026-11-16-2f3098e3`
- Local archive: `backups/2026-11-16-2f3098e3/NayVella-Production-2026-11-16-2f3098e3.tar.gz`
- A matched copy and checksum are also on the encrypted external volume
  `Meridian Glow-MacBook Air` under `NayVella Production Backups`.

The tag records the source recovered from the verified release archive plus
repository housekeeping files. The older Git commit shown in historical
Cloudflare logs is not a match for the entire published source. The archive
includes the exact published build and the verified recovery instructions.

For future work, confirm the active Cloudflare deployment first, then work from
the matching local release reference. Run `npm test` and
`npm run build:production` when validating the next release.
