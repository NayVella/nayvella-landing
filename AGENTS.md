# NayVella Landing production baseline

This repository root is the reference checkout for NayVella Landing. Read
[PRODUCTION.md](PRODUCTION.md) before changing any page or preparing a release.

- Before editing, check the working tree and compare the recorded deployment
  ID with the active production deployment in Cloudflare Pages. If they differ,
  identify and restore the current deployed source before using this checkout
  as a release baseline.
- Use the production source tree for updates. Treat `_site/` as generated build
  output, `output/` as local review material and `backups/` as recovery material.
- Build and test the reviewed source in a clean release directory. After an
  authorized production deploy, verify the public domain and record the new
  deployment ID and matching Git reference together.
