# NayVella Beauty & Care Guide — Phase 1

The Guide is a narrowly scoped Eleventy layer over the existing static site. Existing Arabic and English pages remain authored HTML and are copied to `_site` unchanged by the build. Guide content is source-controlled Markdown under `content/beauty-guide/`.

## Build and output

- Cloudflare Pages build command: `npm run build`
- Explicit production-semantics build: `npm run build:production`
- Explicit preview-semantics build: `npm run build:preview`
- Complete local test suite: `npm test`
- Output directory: `_site`

With no build environment, `npm run build` fails closed to production behavior. On Cloudflare Pages, a non-`main` `CF_PAGES_BRANCH` selects preview behavior; `main` selects production behavior. `CF_PAGES_BRANCH` is provided by Pages and is not a project secret.

## Content records

Each localized article is an independent Markdown file. Arabic and English records share a `translation_group_id`, but either locale can be published without the other.

Supported front matter:

- `id`: stable localized ID, such as `NVBG-001-AR`
- `translation_group_id`: stable cross-locale ID, such as `NVBG-001`
- `language`: `ar` or `en`
- `status`: `Draft`, `Published`, or `Unpublished`
- `category`: one of the five IDs in `categories.json`
- `title`, `slug`, `excerpt`, optional `intro`
- `author`
- `is_pillar`, `is_featured`, `is_seasonal_featured`
- `pillar_article_id`, `related_article_ids`
- `hero_image`, `hero_image_alt`, optional `hero_image_caption`
- optional `created_at`, `published_at`, `updated_at`
- `seo_title`, `meta_description`
- optional `summary`

When `intro` is absent, the first body paragraph is rendered as the article intro and is not repeated in the body. Dates are editorial data only; the build never writes its run time into article metadata.

## Publishing behavior

- Production output and all public collections contain only `Published` records.
- Preview output may contain `Draft` records; Draft pages receive `noindex,nofollow`.
- `Unpublished` records are never rendered.
- Sitemap entries, public `hreflang`, and related cards use `Published` records only.
- The existing `.pages.dev` middleware continues to add preview-host `X-Robots-Tag: noindex, nofollow`.

Preview URLs are not confidential. Phase 1 does not add authentication.

## Markdown blocks

Standard Markdown supports paragraphs, H2, H3, bulleted and numbered lists, quotes, internal links, and external links. The page template supplies the only H1.

Repository image with ALT and optional caption (the quoted title becomes the caption):

```markdown
![Meaningful ALT](/assets/images/example.webp "Optional caption")
```

Callout/note:

```markdown
::: note
Important informational note.
:::
```

Contextual article links use stable group IDs and resolve to a Published record in the current locale:

```markdown
[Contextual label](guide:NVBG-003)
[Guide homepage](guide-home:)
```

External links receive `rel="noopener noreferrer"`. Images must remain in `/assets/`; validation rejects missing local assets and requires meaningful ALT whenever an image exists.

## Published route history

`content/beauty-guide/route-lock.json` is the published route ledger. Changing a Published article's slug or category without updating this ledger fails the build.

Validation also reads every committed version of the ledger from Git history. Any route that was previously published must remain either `current` or in `previous`; changing both the article route and the ledger while omitting the former URL therefore fails the build. Builds require the repository's Git history to be available, as it is in the existing GitHub/Cloudflare Pages workflow.

For an intentional move:

1. Set the article's new full route as `current`.
2. Retain the former full route in `previous`.
3. Run `npm test`.

The build writes each `previous` route as a 301 in the output `_redirects`. It rejects collisions with live routes; deleted content is not redirected indiscriminately.

## CSP generation

The source `_headers` contains the catch-all policy for the existing pages. `scripts/finalize-build.mjs` creates the deployable `_site/_headers` and:

- verifies the 20 legacy JSON-LD hashes against their actual HTML;
- preserves every CSP directive and non-hash source;
- creates 12 Guide scopes: one homepage scope and five category/path scopes per locale;
- detaches the catch-all CSP within each Guide scope and immediately restores the same policy with only that scope's generated JSON-LD hashes;
- enforces Cloudflare Pages' 100-rule and 2,000-character-per-line limits.

`scripts/verify-build.mjs` recomputes every Guide JSON-LD hash and fails if the effective matching policy does not cover it. `npm run test:guards` also removes one required hash from generated output temporarily and proves that validation fails closed.

Any future change to CSP directives or allowed sources remains outside this generator and requires a separate security review and approval.

## Approved Phase 1 media state

The approved Phase 1 package intentionally supplies no article hero or inline images. The templates support future repository images, but the current pages render complete layouts without placeholders or repurposed site artwork.
