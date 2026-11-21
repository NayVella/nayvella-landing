import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  CANONICAL_ORIGIN,
  CATEGORY_ORDER,
  CONTENT_ROOT,
  LOCALES,
  ROOT,
  STATUSES,
  articleRoute,
  canonicalFor,
  categoryRoute,
  guideRoute,
  isVisibleInMode,
  loadGuideData,
  localAssetExists
} from "./guide-core.mjs";

const execFileAsync = promisify(execFile);
const ROUTE_LOCK_RELATIVE = "content/beauty-guide/route-lock.json";

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function duplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate];
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function markdownImages(body) {
  return [...body.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)/g)].map((match) => ({
    alt: match[1].trim(),
    src: match[2].trim(),
    caption: match[3]?.trim() || ""
  }));
}

function guideLinks(body) {
  return [...body.matchAll(/\]\((guide:[^)\s]+|guide-home:)\)/g)].map((match) => match[1]);
}

async function existingCanonicalRoutes() {
  const routes = [];
  for (const locale of LOCALES) {
    const directory = path.join(ROOT, locale);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const candidate = entry.isDirectory() ? path.join(directory, entry.name, "index.html") : null;
      const relative = candidate && path.relative(ROOT, candidate).split(path.sep).join("/");
      if (candidate) {
        try {
          await readFile(candidate, "utf8");
          routes.push(`/${relative.slice(0, -"index.html".length)}`);
        } catch {
          // A locale subdirectory without index.html is not a canonical page.
        }
      }
    }
    routes.push(locale === "ar" ? "/" : "/en");
  }
  return routes.sort();
}

async function committedRouteLockHistory() {
  let logOutput;
  try {
    ({ stdout: logOutput } = await execFileAsync(
      "git",
      ["log", "--format=%H", "--", ROUTE_LOCK_RELATIVE],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 1024 * 1024 }
    ));
  } catch (error) {
    throw new Error(`Published route history cannot be verified because Git history is unavailable (${error.message})`);
  }

  const versions = [];
  for (const commit of logOutput.split(/\r?\n/).filter(Boolean)) {
    let source;
    try {
      ({ stdout: source } = await execFileAsync(
        "git",
        ["show", `${commit}:${ROUTE_LOCK_RELATIVE}`],
        { cwd: ROOT, encoding: "utf8", maxBuffer: 1024 * 1024 }
      ));
    } catch (error) {
      throw new Error(`Could not read the published route ledger at ${commit.slice(0, 12)} (${error.message})`);
    }
    try {
      versions.push({ commit, routeLock: JSON.parse(source) });
    } catch (error) {
      throw new Error(`Invalid historical route ledger at ${commit.slice(0, 12)} (${error.message})`);
    }
  }
  return versions;
}

export function routeHistoryGaps(routeLock, historicalVersions) {
  const gaps = [];
  for (const { commit, routeLock: historical } of historicalVersions) {
    for (const [id, lock] of Object.entries(historical)) {
      const current = routeLock[id];
      if (!current) {
        gaps.push(`${id}: route ledger entry from ${commit.slice(0, 12)} was removed`);
        continue;
      }
      const retained = Array.isArray(current.previous) ? current.previous : [];
      const historicalRoutes = [lock.current, ...(Array.isArray(lock.previous) ? lock.previous : [])].filter(Boolean);
      for (const route of historicalRoutes) {
        if (route !== current.current && !retained.includes(route)) {
          gaps.push(`${id}: published route ${route} from ${commit.slice(0, 12)} was not retained in previous`);
        }
      }
    }
  }
  return [...new Set(gaps)];
}

export async function validateGuideContent(explicitMode) {
  const data = await loadGuideData(explicitMode);
  const { articles, categories, guide, routeLock } = data;
  const committedHistory = await committedRouteLockHistory();
  const errors = [];
  const warnings = [];
  const requiredFields = [
    "id", "translation_group_id", "language", "status", "category", "title", "slug",
    "excerpt", "author", "is_pillar", "is_featured", "is_seasonal_featured",
    "pillar_article_id", "related_article_ids", "hero_image", "hero_image_alt",
    "seo_title", "meta_description"
  ];
  const groupIds = new Set(articles.map((article) => article.translation_group_id));
  const existingRoutes = await existingCanonicalRoutes();
  const allGeneratedRoutes = [
    ...LOCALES.map(guideRoute),
    ...LOCALES.flatMap((locale) => CATEGORY_ORDER.map((category) => categoryRoute(locale, category))),
    ...articles.map(articleRoute)
  ];

  for (const duplicate of duplicates(articles.map((article) => article.id))) {
    errors.push(`Duplicate article ID: ${duplicate}`);
  }
  for (const duplicate of duplicates(articles.map((article) => `${article.language}:${article.slug}`))) {
    errors.push(`Duplicate locale slug: ${duplicate}`);
  }
  for (const duplicate of duplicates(allGeneratedRoutes)) {
    errors.push(`Generated route collision: ${duplicate}`);
  }
  for (const route of allGeneratedRoutes) {
    if (existingRoutes.includes(route)) errors.push(`Guide route collides with an existing page: ${route}`);
  }

  for (const article of articles) {
    const prefix = article.sourceRelative || article.id || "unknown article";
    for (const field of requiredFields) {
      assert(Object.hasOwn(article, field), `${prefix}: missing content field ${field}`, errors);
    }
    assert(/^NVBG-\d{3}-(?:AR|EN)$/.test(article.id), `${prefix}: invalid stable article ID`, errors);
    assert(/^NVBG-\d{3}$/.test(article.translation_group_id), `${prefix}: invalid translation_group_id`, errors);
    assert(article.id?.startsWith(`${article.translation_group_id}-`), `${prefix}: ID does not belong to translation group`, errors);
    assert(LOCALES.includes(article.language), `${prefix}: invalid language ${article.language}`, errors);
    const expectedSuffix = article.language === "ar" ? "-AR" : "-EN";
    assert(article.id?.endsWith(expectedSuffix), `${prefix}: ID suffix does not match language`, errors);
    assert(STATUSES.includes(article.status), `${prefix}: invalid status ${article.status}`, errors);
    assert(CATEGORY_ORDER.includes(article.category), `${prefix}: unknown category ${article.category}`, errors);
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug || ""), `${prefix}: slug must be lowercase English ASCII kebab-case`, errors);
    assert(article.route === articleRoute(article), `${prefix}: derived route mismatch`, errors);
    assert(article.canonical === canonicalFor(article.route), `${prefix}: invalid canonical generation`, errors);
    assert(article.canonical.startsWith(`${CANONICAL_ORIGIN}/`), `${prefix}: canonical uses the wrong origin`, errors);
    assert(!/^#\s+/m.test(article.body), `${prefix}: article body must not contain an H1`, errors);
    assert(article.body.trim().length > 0, `${prefix}: article content is empty`, errors);

    if (article.status === "Published") {
      assert(typeof article.title === "string" && article.title.trim(), `${prefix}: Published title is required`, errors);
      assert(typeof article.slug === "string" && article.slug.trim(), `${prefix}: Published slug is required`, errors);
      assert(typeof article.excerpt === "string" && article.excerpt.trim(), `${prefix}: Published excerpt is required`, errors);
      assert(typeof article.author === "string" && article.author.trim(), `${prefix}: Published author is required`, errors);
    }
    for (const field of ["is_pillar", "is_featured", "is_seasonal_featured"]) {
      assert(typeof article[field] === "boolean", `${prefix}: ${field} must be boolean`, errors);
    }
    assert(Array.isArray(article.related_article_ids), `${prefix}: related_article_ids must be an array`, errors);
    for (const relatedId of article.related_article_ids || []) {
      assert(groupIds.has(relatedId), `${prefix}: broken related article ID ${relatedId}`, errors);
      assert(relatedId !== article.translation_group_id, `${prefix}: article cannot relate to itself`, errors);
    }
    if (article.pillar_article_id) {
      assert(groupIds.has(article.pillar_article_id), `${prefix}: broken Pillar ID ${article.pillar_article_id}`, errors);
      assert(article.pillar_article_id !== article.translation_group_id, `${prefix}: article cannot be its own Pillar parent`, errors);
    }

    if (article.hero_image) {
      assert(typeof article.hero_image_alt === "string" && article.hero_image_alt.trim(), `${prefix}: hero ALT is required when a hero image exists`, errors);
      assert(localAssetExists(article.hero_image), `${prefix}: invalid or missing local hero asset ${article.hero_image}`, errors);
    }
    for (const image of markdownImages(article.body)) {
      assert(Boolean(image.alt), `${prefix}: inline image ALT is required for ${image.src}`, errors);
      assert(image.src.startsWith("/assets/"), `${prefix}: inline images must use the repository /assets/ model (${image.src})`, errors);
      assert(localAssetExists(image.src), `${prefix}: invalid or missing inline image asset ${image.src}`, errors);
    }
    for (const link of guideLinks(article.body)) {
      if (link === "guide-home:") continue;
      const target = link.slice("guide:".length);
      assert(groupIds.has(target), `${prefix}: broken contextual Guide link ${target}`, errors);
      assert(Boolean(data.resolveLocalized(target, article.language, true)), `${prefix}: contextual link has no Published ${article.language} target (${target})`, errors);
    }

    for (const field of ["created_at", "published_at", "updated_at"]) {
      if (article[field]) assert(validDate(article[field]), `${prefix}: ${field} must be a real YYYY-MM-DD editorial date`, errors);
    }
    if (article.published_at && article.updated_at) {
      assert(article.updated_at >= article.published_at, `${prefix}: updated_at cannot predate published_at`, errors);
    }
  }

  const translations = new Map();
  for (const article of articles) {
    const key = `${article.translation_group_id}:${article.language}`;
    assert(!translations.has(key), `Invalid translation relationship: more than one ${key} record`, errors);
    translations.set(key, article);
  }
  for (const groupId of groupIds) {
    const pair = articles.filter((article) => article.translation_group_id === groupId);
    assert(pair.length <= 2, `Invalid translation relationship: ${groupId} has more than two localized records`, errors);
    if (pair.length === 2) {
      assert(pair[0].category === pair[1].category, `Invalid translation relationship: ${groupId} categories differ`, errors);
    }
  }

  assert(JSON.stringify(Object.keys(categories)) === JSON.stringify(CATEGORY_ORDER), "Category registry must contain exactly the five approved categories in order", errors);
  for (const category of CATEGORY_ORDER) {
    for (const locale of LOCALES) {
      const meta = categories[category]?.[locale];
      assert(Boolean(meta?.name && meta?.h1 && meta?.intro), `Missing ${locale} category metadata for ${category}`, errors);
    }
  }
  for (const locale of LOCALES) {
    const meta = guide[locale];
    assert(Boolean(meta?.h1 && meta?.intro && meta?.seo_title && meta?.meta_description), `Missing ${locale} Guide homepage metadata`, errors);
  }

  const published = articles.filter((article) => article.status === "Published");
  for (const article of published) {
    const lock = routeLock[article.id];
    assert(Boolean(lock), `${article.id}: Published article is missing from route-lock.json`, errors);
    if (!lock) continue;
    assert(lock.current === article.route, `${article.id}: unsafe published route change; update the route ledger and retain ${lock.current} in previous`, errors);
    assert(Array.isArray(lock.previous), `${article.id}: route-lock previous must be an array`, errors);
  }
  for (const [id, lock] of Object.entries(routeLock)) {
    assert(Boolean(articles.find((article) => article.id === id)), `Route lock references unknown article ${id}`, errors);
    assert(typeof lock.current === "string" && lock.current.startsWith("/") && lock.current.endsWith("/"), `${id}: invalid current route lock`, errors);
    assert(Array.isArray(lock.previous), `${id}: previous route history must be an array`, errors);
  }
  const previousRoutes = Object.values(routeLock).flatMap((lock) => lock.previous || []);
  for (const duplicate of duplicates(previousRoutes)) errors.push(`Duplicate historical redirect source: ${duplicate}`);
  const redirectsSource = await readFile(path.join(ROOT, "_redirects"), "utf8");
  const existingRedirectSources = redirectsSource.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/)[0]);
  for (const [id, lock] of Object.entries(routeLock)) {
    const locale = id.endsWith("-AR") ? "ar" : "en";
    for (const route of lock.previous || []) {
      assert(new RegExp(`^/${locale}/beauty-guide/(?:${CATEGORY_ORDER.join("|")})/[a-z0-9]+(?:-[a-z0-9]+)*/$`).test(route), `${id}: historical route is outside its localized Guide article namespace: ${route}`, errors);
    }
  }
  for (const route of previousRoutes) {
    assert(route.startsWith("/") && route.endsWith("/"), `Historical route must be a full slash-delimited path: ${route}`, errors);
    assert(!allGeneratedRoutes.includes(route), `Historical redirect collides with a live route: ${route}`, errors);
    assert(!existingRoutes.includes(route), `Historical redirect collides with an existing canonical page: ${route}`, errors);
    assert(!existingRedirectSources.includes(route), `Historical redirect collides with an existing redirect source: ${route}`, errors);
  }
  for (const gap of routeHistoryGaps(routeLock, committedHistory)) errors.push(gap);

  for (const redirect of ["/ar / 301", "/ar/ / 301", "/en/ /en 301"]) {
    assert(redirectsSource.split(/\r?\n/).includes(redirect), `Missing homepage redirect: ${redirect}`, errors);
  }

  const stateFixtures = [
    { status: "Published" },
    { status: "Draft" },
    { status: "Unpublished" }
  ];
  assert(stateFixtures.filter((item) => isVisibleInMode(item, "production")).length === 1, "Production state filter must expose only Published", errors);
  assert(stateFixtures.filter((item) => isVisibleInMode(item, "preview")).length === 2, "Preview state filter must expose Published and Draft only", errors);
  assert(!isVisibleInMode({ status: "Unpublished" }, "preview"), "Unpublished content must never be rendered", errors);

  for (const category of CATEGORY_ORDER) {
    const hasPillar = published.some((article) => article.category === category && article.is_pillar);
    if (!hasPillar) warnings.push(`${category}: no approved Pillar article; category Pillar section will be omitted`);
  }
  if (!published.some((article) => article.published_at)) {
    warnings.push("No approved publication dates; Latest uses deterministic editorial registry order and date metadata remains absent");
  }

  if (errors.length) {
    throw new Error(`Guide content validation failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  }

  return {
    mode: data.mode,
    articleCount: articles.length,
    publishedCount: published.length,
    visibleCount: data.visibleArticles.length,
    routeCount: allGeneratedRoutes.length,
    warnings
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await validateGuideContent();
  console.log(`Guide content validation passed: ${report.articleCount} records, ${report.publishedCount} Published, ${report.routeCount} generated routes (${report.mode}).`);
  for (const warning of report.warnings) console.log(`Validation note: ${warning}`);
}
