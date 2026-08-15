import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import YAML from "yaml";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(SCRIPT_DIR, "..");
export const CONTENT_ROOT = path.join(ROOT, "content", "beauty-guide");
export const OUTPUT_ROOT = path.join(ROOT, "_site");
export const CANONICAL_ORIGIN = "https://nayvella.com";
export const PRODUCTION_BRANCH = "main";
export const CATEGORY_ORDER = ["skincare", "makeup", "haircare", "guides", "seasonal"];
export const LOCALES = ["ar", "en"];
export const STATUSES = ["Draft", "Published", "Unpublished"];

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeXml(value = "") {
  return escapeHtml(value);
}

export function canonicalFor(route) {
  if (!route?.startsWith("/") || !route.endsWith("/")) {
    throw new Error(`Cannot generate canonical for invalid route: ${route}`);
  }
  return `${CANONICAL_ORIGIN}${route}`;
}

export function articleRoute(article) {
  return `/${article.language}/beauty-guide/${article.category}/${article.slug}/`;
}

export function categoryRoute(locale, category) {
  return `/${locale}/beauty-guide/${category}/`;
}

export function guideRoute(locale) {
  return `/${locale}/beauty-guide/`;
}

export function outputPathForRoute(route) {
  return path.join(OUTPUT_ROOT, route.replace(/^\//, ""), "index.html");
}

export function routeForOutputFile(filePath) {
  const relative = path.relative(OUTPUT_ROOT, filePath).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -"index.html".length)}`;
  return `/${relative}`;
}

export function getBuildMode(explicitMode = process.env.NAYVELLA_BUILD_MODE) {
  const inferred = process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== PRODUCTION_BRANCH
    ? "preview"
    : "production";
  const mode = explicitMode || inferred;
  if (!['production', 'preview'].includes(mode)) {
    throw new Error(`NAYVELLA_BUILD_MODE must be production or preview, received: ${mode}`);
  }
  return mode;
}

export function isVisibleInMode(article, mode) {
  if (article.status === "Published") return true;
  return mode === "preview" && article.status === "Draft";
}

export function isPublic(article) {
  return article.status === "Published";
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export function parseFrontMatter(source, sourcePath = "content record") {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`Missing YAML front matter in ${sourcePath}`);
  const data = YAML.parse(match[1]);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Front matter must be a YAML object in ${sourcePath}`);
  }
  return { data, body: match[2].trim() };
}

export async function loadArticles() {
  const records = [];
  for (const locale of LOCALES) {
    const directory = path.join(CONTENT_ROOT, "articles", locale);
    const names = (await readdir(directory)).filter((name) => name.endsWith(".md")).sort();
    for (const name of names) {
      const sourcePath = path.join(directory, name);
      const source = await readFile(sourcePath, "utf8");
      const { data, body } = parseFrontMatter(source, sourcePath);
      records.push({
        ...data,
        body,
        sourcePath,
        sourceRelative: path.relative(ROOT, sourcePath).split(path.sep).join("/"),
        route: articleRoute(data),
        canonical: canonicalFor(articleRoute(data))
      });
    }
  }
  return records.sort((a, b) => a.id.localeCompare(b.id));
}

function articleMapByGroupAndLocale(articles) {
  const map = new Map();
  for (const article of articles) {
    map.set(`${article.translation_group_id}:${article.language}`, article);
  }
  return map;
}

function localizedArticle(articles, groupId, locale, publishedOnly = false) {
  return articles.find((article) =>
    article.translation_group_id === groupId &&
    article.language === locale &&
    (!publishedOnly || article.status === "Published")
  );
}

export async function loadGuideData(explicitMode) {
  const mode = getBuildMode(explicitMode);
  const [articles, categories, guide, routeLock, legacySitemap] = await Promise.all([
    loadArticles(),
    readJson(path.join(CONTENT_ROOT, "categories.json")),
    readJson(path.join(CONTENT_ROOT, "guide.json")),
    readJson(path.join(CONTENT_ROOT, "route-lock.json")),
    legacySitemapEntries()
  ]);
  const articleByGroupLocale = articleMapByGroupAndLocale(articles);
  const visibleArticles = articles.filter((article) => isVisibleInMode(article, mode));
  const publishedArticles = articles.filter(isPublic);

  const resolveLocalized = (groupId, locale, publishedOnly = false) => {
    const record = articleByGroupLocale.get(`${groupId}:${locale}`);
    if (!record || (publishedOnly && record.status !== "Published")) return null;
    return record;
  };

  const localizedVisible = (groupId, locale) => {
    const record = resolveLocalized(groupId, locale);
    return record && isVisibleInMode(record, mode) ? record : null;
  };

  const categoryPages = LOCALES.flatMap((locale) => CATEGORY_ORDER.map((category) => ({
    locale,
    category,
    meta: categories[category][locale],
    route: categoryRoute(locale, category)
  })));

  return {
    mode,
    articles,
    visibleArticles,
    publishedArticles,
    categories,
    guide,
    routeLock,
    locales: LOCALES,
    categoryOrder: CATEGORY_ORDER,
    categoryPages,
    legacySitemap,
    resolveLocalized,
    localizedVisible,
    localizedArticle: (groupId, locale) => localizedArticle(articles, groupId, locale)
  };
}

function calloutPlugin(md) {
  md.block.ruler.before("fence", "nayvella_callout", (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const opening = state.src.slice(start, max).trim();
    if (!/^:::\s*(?:note|callout)\s*$/i.test(opening)) return false;
    if (silent) return true;

    let nextLine = startLine + 1;
    for (; nextLine < endLine; nextLine += 1) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const lineEnd = state.eMarks[nextLine];
      if (/^:::\s*$/.test(state.src.slice(lineStart, lineEnd).trim())) break;
    }
    if (nextLine >= endLine) return false;

    const open = state.push("nayvella_callout_open", "aside", 1);
    open.block = true;
    state.md.block.tokenize(state, startLine + 1, nextLine);
    const close = state.push("nayvella_callout_close", "aside", -1);
    close.block = true;
    state.line = nextLine + 1;
    return true;
  });
  md.renderer.rules.nayvella_callout_open = () => '<aside class="guide-callout" role="note">\n';
  md.renderer.rules.nayvella_callout_close = () => "</aside>\n";
}

function createMarkdownRenderer({ article, guideData }) {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  calloutPlugin(md);

  md.renderer.rules.heading_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    if (token.tag === "h2" || token.tag === "h3") {
      env.headingCounter = (env.headingCounter || 0) + 1;
      token.attrSet("id", `section-${env.headingCounter}`);
    }
    return self.renderToken(tokens, index, options);
  };

  const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = token.attrGet("href") || "";
    if (href.startsWith("guide:")) {
      const groupId = href.slice("guide:".length);
      const target = guideData.resolveLocalized(groupId, article.language, true);
      token.attrSet("href", target?.route || guideRoute(article.language));
    } else if (href === "guide-home:") {
      token.attrSet("href", guideRoute(article.language));
    } else if (/^https?:\/\//i.test(href)) {
      token.attrSet("rel", "noopener noreferrer");
    }
    return defaultLinkOpen(tokens, index, options, env, self);
  };

  md.renderer.rules.image = (tokens, index) => {
    const token = tokens[index];
    const src = token.attrGet("src") || "";
    const alt = token.content || "";
    const caption = token.attrGet("title") || "";
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async"${caption ? ` data-caption="${escapeHtml(caption)}"` : ""}>`;
  };

  return md;
}

export function splitArticleIntro(body) {
  const normalized = body.trim();
  const separator = normalized.search(/\r?\n\s*\r?\n/);
  if (separator === -1) return { intro: normalized, remainder: "" };
  return {
    intro: normalized.slice(0, separator).trim(),
    remainder: normalized.slice(separator).trim()
  };
}

function inlineTextFromHeading(tokens, startIndex) {
  const inline = tokens[startIndex + 1];
  return inline?.type === "inline" ? inline.content : "";
}

export function renderArticleMarkdown(article, guideData) {
  const split = splitArticleIntro(article.body);
  const intro = article.intro?.trim() || split.intro;
  const remainder = article.intro?.trim() ? article.body.trim() : split.remainder;
  const md = createMarkdownRenderer({ article, guideData });
  const introHtml = md.render(intro, { headingCounter: 0 });
  const tokens = md.parse(remainder, {});
  const toc = [];
  let headingNumber = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "heading_open" && ["h2", "h3"].includes(token.tag)) {
      headingNumber += 1;
      toc.push({
        level: Number(token.tag.slice(1)),
        id: `section-${headingNumber}`,
        text: inlineTextFromHeading(tokens, index)
      });
    }
  }
  let bodyHtml = md.render(remainder, { headingCounter: 0 });
  bodyHtml = bodyHtml.replace(
    /<p>(<img\b[^>]*>)<\/p>/g,
    (_match, image) => {
      const caption = image.match(/\sdata-caption="([^"]*)"/)?.[1] || "";
      return `<figure class="guide-figure">${image.replace(/\sdata-caption="[^"]*"/, "")}${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
    }
  );
  return { introHtml, bodyHtml, toc: toc.length >= 3 ? toc : [] };
}

export function safeJsonLd(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replace(/<\/script/gi, "\\u003c/script");
}

export function sha256Source(value) {
  return `'sha256-${createHash("sha256").update(value).digest("base64")}'`;
}

export function extractJsonLdBlocks(html) {
  return [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
}

export function extractInlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((match) => ({
    attributes: match[1],
    content: match[2]
  }));
}

export async function legacySitemapEntries() {
  const source = await readFile(path.join(ROOT, "sitemap.xml"), "utf8");
  return [...source.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1].trim());
}

export function formatDate(value, locale) {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

export function localAssetExists(assetPath) {
  if (!assetPath?.startsWith("/assets/")) return false;
  const target = path.resolve(ROOT, assetPath.slice(1));
  return target.startsWith(path.join(ROOT, "assets") + path.sep) && existsSync(target);
}
