import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  OUTPUT_ROOT,
  extractJsonLdBlocks,
  isVisibleInMode,
  loadGuideData,
  renderArticleMarkdown,
  sha256Source
} from "./guide-core.mjs";
import { renderArticlePage } from "../guide-src/_lib/render.mjs";
import { routeHistoryGaps } from "./validate-guide-content.mjs";
import { verifyBuild } from "./verify-build.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const guideData = await loadGuideData("preview");
const sample = guideData.articles[0];
const draftHtml = renderArticlePage({ ...sample, status: "Draft" }, guideData);
invariant(/name="robots"/.test(draftHtml) && /content="noindex,nofollow"/.test(draftHtml), "Draft rendering must be noindex,nofollow");
invariant(isVisibleInMode({ status: "Published" }, "production"), "Published must render in production");
invariant(!isVisibleInMode({ status: "Draft" }, "production"), "Draft must not render in production");
invariant(isVisibleInMode({ status: "Draft" }, "preview"), "Draft must render in preview");
invariant(!isVisibleInMode({ status: "Unpublished" }, "preview"), "Unpublished must never render");

const historicalLedger = [{
  commit: "0123456789abcdef",
  routeLock: {
    "NVBG-001-EN": { current: "/en/beauty-guide/skincare/old-route/", previous: [] }
  }
}];
const unsafeLedger = {
  "NVBG-001-EN": { current: "/en/beauty-guide/skincare/new-route/", previous: [] }
};
const safeLedger = {
  "NVBG-001-EN": {
    current: "/en/beauty-guide/skincare/new-route/",
    previous: ["/en/beauty-guide/skincare/old-route/"]
  }
};
invariant(routeHistoryGaps(unsafeLedger, historicalLedger).length === 1, "Published route changes must fail when the old URL is omitted");
invariant(routeHistoryGaps(safeLedger, historicalLedger).length === 0, "Published route changes must pass when the old URL is retained");

const markdownTarget = guideData.resolveLocalized("NVBG-002", sample.language, true);
const markdownFixture = renderArticleMarkdown({
  ...sample,
  intro: null,
  body: `Intro paragraph.

## Heading one

- List item

## Heading two

![Descriptive alt text](/assets/images/example.jpg "Editorial caption")

::: note
Callout copy.
:::

## Heading three

> Quoted copy.

[Internal guide](guide:NVBG-002)

[External reference](https://example.com)`
}, guideData);
invariant(markdownFixture.toc.length === 3, "Markdown TOC must appear at the three-heading threshold");
invariant(markdownFixture.bodyHtml.includes('<h2 id="section-1">Heading one</h2>'), "Markdown headings must receive stable anchors");
invariant(markdownFixture.bodyHtml.includes("<ul>"), "Markdown lists must render");
invariant(markdownFixture.bodyHtml.includes('<figure class="guide-figure">'), "Markdown images must render as figures");
invariant(markdownFixture.bodyHtml.includes("<figcaption>Editorial caption</figcaption>"), "Markdown image titles must render as captions");
invariant(markdownFixture.bodyHtml.includes('<aside class="guide-callout" role="note">'), "Markdown callouts must render");
invariant(markdownFixture.bodyHtml.includes("<blockquote>"), "Markdown blockquotes must render");
invariant(markdownFixture.bodyHtml.includes(`href="${markdownTarget.route}"`), "Contextual Guide links must resolve in the article locale");
invariant(markdownFixture.bodyHtml.includes('href="https://example.com" rel="noopener noreferrer"'), "External links must receive safe relationship attributes");

const headersPath = path.join(OUTPUT_ROOT, "_headers");
const guideHomePath = path.join(OUTPUT_ROOT, "ar", "beauty-guide", "index.html");
const originalHeaders = await readFile(headersPath, "utf8");
const guideHome = await readFile(guideHomePath, "utf8");
const jsonLd = extractJsonLdBlocks(guideHome)[0];
const requiredHash = sha256Source(jsonLd);
invariant(originalHeaders.includes(requiredHash), "Test precondition failed: Guide home hash is absent");

let coverageGuardFailedClosed = false;
try {
  await writeFile(headersPath, originalHeaders.replace(requiredHash, ""), "utf8");
  try {
    await verifyBuild("preview");
  } catch (error) {
    coverageGuardFailedClosed = /JSON-LD hash is not covered/.test(error.message);
  }
} finally {
  await writeFile(headersPath, originalHeaders, "utf8");
}
invariant(coverageGuardFailedClosed, "CSP coverage validation did not fail after removing a required Guide JSON-LD hash");

console.log("Build guard tests passed: publishing states are fail-closed and missing Guide CSP coverage is rejected.");
