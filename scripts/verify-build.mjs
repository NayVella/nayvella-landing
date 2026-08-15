import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_ORIGIN,
  CATEGORY_ORDER,
  LOCALES,
  OUTPUT_ROOT,
  ROOT,
  extractInlineScripts,
  extractJsonLdBlocks,
  guideRoute,
  loadGuideData,
  routeForOutputFile,
  sha256Source
} from "./guide-core.mjs";

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function parseHeaderRules(source) {
  const rules = [];
  let current = null;
  for (const rawLine of source.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!/^\s/.test(rawLine)) {
      current = { pattern: trimmed, operations: [] };
      rules.push(current);
      continue;
    }
    if (!current) throw new Error(`Header operation without a rule: ${rawLine}`);
    if (trimmed.startsWith("! ")) {
      current.operations.push({ type: "detach", name: trimmed.slice(2).trim() });
      continue;
    }
    const colon = trimmed.indexOf(":");
    if (colon === -1) throw new Error(`Invalid header operation: ${rawLine}`);
    current.operations.push({ type: "attach", name: trimmed.slice(0, colon), value: trimmed.slice(colon + 1).trim() });
  }
  return rules;
}

function patternMatches(pattern, route) {
  if (!pattern.includes("*")) return pattern === route;
  const escaped = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${escaped}$`).test(route);
}

function headersForRoute(rules, route) {
  const headers = new Map();
  for (const rule of rules) {
    if (!patternMatches(rule.pattern, route)) continue;
    for (const operation of rule.operations) {
      const key = operation.name.toLowerCase();
      if (operation.type === "detach") headers.delete(key);
      else headers.set(key, headers.has(key) ? `${headers.get(key)}, ${operation.value}` : operation.value);
    }
  }
  return headers;
}

function stripHashes(policy) {
  return policy.replace(/\s+'sha256-[^']+'/g, "").replace(/\s+/g, " ").trim();
}

function extractAttribute(html, elementPattern, name) {
  const match = html.match(elementPattern);
  if (!match) return null;
  const attribute = match[0].match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return attribute?.[1] || null;
}

function hrefs(html) {
  return [...html.matchAll(/\bhref=["']([^"']+)["']/gi)].map((match) => match[1]);
}

function imageSources(html) {
  return [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
}

function normalizeInternalPath(href) {
  if (!href.startsWith("/")) return null;
  const url = new URL(href, CANONICAL_ORIGIN);
  return url.pathname;
}

export async function verifyBuild(explicitMode) {
  const guideData = await loadGuideData(explicitMode);
  const errors = [];
  const allFiles = await walk(OUTPUT_ROOT);
  const allOutputRoutes = new Set(allFiles.map((file) => {
    const relative = path.relative(OUTPUT_ROOT, file).split(path.sep).join("/");
    if (relative.endsWith("index.html")) return routeForOutputFile(file);
    return `/${relative}`;
  }));
  const guideHtmlFiles = allFiles.filter((file) => file.endsWith("index.html") && routeForOutputFile(file).includes("/beauty-guide/"));
  const expectedGuideRoutes = new Set([
    ...LOCALES.map(guideRoute),
    ...LOCALES.flatMap((locale) => CATEGORY_ORDER.map((category) => `/${locale}/beauty-guide/${category}/`)),
    ...guideData.visibleArticles.map((article) => article.route)
  ]);
  assert(guideHtmlFiles.length === expectedGuideRoutes.size, `Expected ${expectedGuideRoutes.size} Guide pages, found ${guideHtmlFiles.length}`, errors);
  for (const route of expectedGuideRoutes) assert(allOutputRoutes.has(route), `Missing generated Guide route ${route}`, errors);

  const sourceHeaders = await readFile(path.join(ROOT, "_headers"), "utf8");
  const outputHeaders = await readFile(path.join(OUTPUT_ROOT, "_headers"), "utf8");
  const headerRules = parseHeaderRules(outputHeaders);
  const sourceRules = parseHeaderRules(sourceHeaders);
  const globalPolicy = headersForRoute(sourceRules, "/ar/").get("content-security-policy");
  const basePolicy = stripHashes(globalPolicy);
  assert(headerRules.length <= 100, `_headers has ${headerRules.length} rules; Cloudflare maximum is 100`, errors);
  for (const line of outputHeaders.split(/\r?\n/)) {
    assert(line.length <= 2000, `_headers line exceeds Cloudflare's 2,000-character limit`, errors);
  }

  for (const file of guideHtmlFiles) {
    const route = routeForOutputFile(file);
    const relative = path.relative(OUTPUT_ROOT, file).split(path.sep).join("/");
    const html = await readFile(file, "utf8");
    const expectedLocale = route.startsWith("/ar/") ? "ar" : "en";
    const expectedLang = expectedLocale === "ar" ? "ar-SA" : "en";
    const expectedDir = expectedLocale === "ar" ? "rtl" : "ltr";
    const jsonBlocks = extractJsonLdBlocks(html);
    const inlineScripts = extractInlineScripts(html).filter((script) => !/\bsrc\s*=/i.test(script.attributes));
    const csp = headersForRoute(headerRules, route).get("content-security-policy");

    assert(/^<!DOCTYPE html>/i.test(html), `${relative}: missing HTML doctype`, errors);
    assert(new RegExp(`<html\\b[^>]*lang=["']${expectedLang}["'][^>]*dir=["']${expectedDir}["']|<html\\b[^>]*dir=["']${expectedDir}["'][^>]*lang=["']${expectedLang}["']`, "i").test(html), `${relative}: incorrect lang/dir`, errors);
    assert((html.match(/<h1\b/gi) || []).length === 1, `${relative}: must contain exactly one H1`, errors);
    assert(Boolean(extractAttribute(html, /<link\b[^>]*rel=["']canonical["'][^>]*>/i, "href")), `${relative}: missing canonical`, errors);
    const canonical = extractAttribute(html, /<link\b[^>]*rel=["']canonical["'][^>]*>/i, "href");
    assert(canonical === `${CANONICAL_ORIGIN}${route}`, `${relative}: canonical mismatch (${canonical})`, errors);
    assert(Boolean(extractAttribute(html, /<meta\b[^>]*name=["']description["'][^>]*>/i, "content")), `${relative}: missing meta description`, errors);
    assert(Boolean(extractAttribute(html, /<meta\b[^>]*name=["']robots["'][^>]*>/i, "content")), `${relative}: missing robots metadata`, errors);
    assert(/property=["']og:title["']/i.test(html) && /property=["']og:description["']/i.test(html) && /property=["']og:url["']/i.test(html), `${relative}: incomplete Open Graph metadata`, errors);
    assert(/name=["']twitter:card["']/i.test(html) && /name=["']twitter:title["']/i.test(html), `${relative}: incomplete Twitter metadata`, errors);
    assert(/hreflang=["']x-default["']/i.test(html), `${relative}: missing x-default`, errors);
    assert(jsonBlocks.length === 1, `${relative}: must contain exactly one JSON-LD block`, errors);
    for (const block of jsonBlocks) {
      try { JSON.parse(block); } catch (error) { errors.push(`${relative}: invalid JSON-LD (${error.message})`); }
      assert(csp?.includes(sha256Source(block)), `${relative}: generated JSON-LD hash is not covered by its effective CSP`, errors);
    }
    assert(inlineScripts.length === jsonBlocks.length, `${relative}: executable inline script detected`, errors);
    for (const script of inlineScripts) {
      assert(/\btype=["']application\/ld\+json["']/i.test(script.attributes), `${relative}: non-JSON-LD inline script detected`, errors);
    }
    assert(!/\son[a-z]+\s*=/i.test(html), `${relative}: inline event handler detected`, errors);
    assert(!/\sstyle\s*=/i.test(html), `${relative}: inline style attribute detected`, errors);
    assert(Boolean(csp), `${relative}: no effective CSP`, errors);
    assert(stripHashes(csp || "") === basePolicy, `${relative}: CSP directives or non-hash sources changed`, errors);
    assert(!(csp || "").includes("'unsafe-inline'"), `${relative}: CSP contains unsafe-inline`, errors);
    assert(/\/assets\/css\/beauty-guide\.css/.test(html), `${relative}: Guide stylesheet is missing`, errors);

    for (const href of hrefs(html)) {
      if (/^(?:https?:|mailto:|tel:|#)/i.test(href)) continue;
      const internal = normalizeInternalPath(href);
      if (!internal) continue;
      assert(allOutputRoutes.has(internal), `${relative}: broken internal link ${href}`, errors);
    }
    for (const source of imageSources(html)) {
      const internal = normalizeInternalPath(source);
      if (!internal) continue;
      assert(allOutputRoutes.has(internal), `${relative}: broken image source ${source}`, errors);
    }
  }

  for (const locale of LOCALES) {
    const sourceFiles = (await walk(path.join(ROOT, locale)))
      .filter((file) => file.endsWith("index.html"))
      .map((file) => path.relative(ROOT, file));
    for (const relative of sourceFiles) {
      const source = await readFile(path.join(ROOT, relative), "utf8");
      const output = await readFile(path.join(OUTPUT_ROOT, relative), "utf8");
      assert(source === output, `${relative}: existing canonical page changed during passthrough`, errors);
    }
  }

  const sitemap = await readFile(path.join(OUTPUT_ROOT, "sitemap.xml"), "utf8");
  const sitemapLocs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert(sitemapLocs.length === 20 + 2 + 10 + guideData.publishedArticles.length, `Sitemap URL count is ${sitemapLocs.length}; expected ${20 + 2 + 10 + guideData.publishedArticles.length}`, errors);
  assert(new Set(sitemapLocs).size === sitemapLocs.length, "Sitemap contains duplicate URLs", errors);
  for (const article of guideData.publishedArticles) assert(sitemapLocs.includes(article.canonical), `Sitemap missing Published article ${article.id}`, errors);
  for (const article of guideData.articles.filter((item) => item.status !== "Published")) assert(!sitemapLocs.includes(article.canonical), `Sitemap leaked ${article.status} article ${article.id}`, errors);
  assert(!/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap) || guideData.publishedArticles.some((article) => article.published_at || article.updated_at), "Sitemap invented a lastmod date", errors);

  const redirects = await readFile(path.join(OUTPUT_ROOT, "_redirects"), "utf8");
  assert(redirects.split(/\r?\n/).includes("/ /ar/ 302"), "Generated redirects changed the root redirect", errors);
  for (const article of guideData.publishedArticles) {
    for (const previous of guideData.routeLock[article.id].previous) {
      assert(redirects.split(/\r?\n/).includes(`${previous} ${article.route} 301`), `Missing historical 301 ${previous}`, errors);
    }
  }

  for (const article of guideData.visibleArticles) {
    const file = path.join(OUTPUT_ROOT, article.route.slice(1), "index.html");
    const html = await readFile(file, "utf8");
    const json = JSON.parse(extractJsonLdBlocks(html)[0]);
    assert(json["@graph"].some((node) => node["@type"] === "BlogPosting"), `${article.id}: missing BlogPosting structured data`, errors);
    assert(json["@graph"].some((node) => node["@type"] === "BreadcrumbList"), `${article.id}: missing Breadcrumb structured data`, errors);
    const robots = extractAttribute(html, /<meta\b[^>]*name=["']robots["'][^>]*>/i, "content");
    assert(article.status === "Published" ? robots.startsWith("index,follow") : robots === "noindex,nofollow", `${article.id}: incorrect robots state`, errors);
    const headingCount = [...article.body.matchAll(/^#{2,3}\s+/gm)].length;
    assert(headingCount >= 3 ? html.includes("class=\"guide-toc\"") : !html.includes("class=\"guide-toc\""), `${article.id}: automatic TOC threshold mismatch`, errors);
    if (!article.hero_image) assert(!html.includes("class=\"reading-container guide-hero-image\""), `${article.id}: missing-image layout emitted a hero placeholder`, errors);
    if (!article.published_at) assert(!/datePublished/.test(html), `${article.id}: invented publication date`, errors);
    if (!article.updated_at) assert(!/dateModified/.test(html), `${article.id}: invented update date`, errors);
  }

  if (errors.length) throw new Error(`Build verification failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  return {
    mode: guideData.mode,
    guidePages: guideHtmlFiles.length,
    sitemapUrls: sitemapLocs.length,
    headerRules: headerRules.length
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await verifyBuild();
  console.log(`Build verification passed: ${report.guidePages} Guide pages, ${report.sitemapUrls} sitemap URLs, ${report.headerRules} header rules (${report.mode}).`);
}
