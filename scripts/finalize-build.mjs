import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CATEGORY_ORDER,
  LOCALES,
  OUTPUT_ROOT,
  ROOT,
  extractJsonLdBlocks,
  loadGuideData,
  routeForOutputFile,
  sha256Source
} from "./guide-core.mjs";

const CSP_HEADER = "Content-Security-Policy";
const LEGACY_STALE_HASHES = [
  "'sha256-olCWI+Odov6OUS7wjsfu8uK4fmKWlZVRDgclBW4kLN0='",
  "'sha256-JnXdCxgLkP79Fjay1xxqZsI3ega2D9trgEa4l1b0hQU='",
  "'sha256-0YuryS6uJLvPZN9jHGed4ND+Y/mlQelBI1aeGlKAutI='"
];
export const CORRECTED_LEGACY_HASHES = {
  "/ar/beauty-experts/": "'sha256-jJJNT7OUMylefTp/JxC0G0tuC15tRRzWTV2AU0AKDGA='",
  "/ar/customers/": "'sha256-bQvyL5WBCGUkDwdCtcCNE2yapoCxagl4M8bvfrfJAkY='",
  "/ar/merchants/": "'sha256-tk0Mtm7swZYuQufSg5VSd4h2gGr/Zl55DCQh5ZqLmmY='"
};

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

function hashSources(policy) {
  return [...policy.matchAll(/'sha256-[^']+'/g)].map((match) => match[0]);
}

function stripHashes(policy) {
  return policy.replace(/\s+'sha256-[^']+'/g, "").replace(/\s+/g, " ").trim();
}

function policyWithHashes(basePolicy, hashes) {
  const unique = [...new Set(hashes)].sort();
  return basePolicy.replace(/(script-src\s+[^;]*)(;)/, `$1 ${unique.join(" ")}$2`);
}

function globalPolicyFromHeaders(source) {
  const match = source.match(/^\/\*\r?\n(?:[ \t]+[^\r\n]+\r?\n)*?[ \t]+Content-Security-Policy:\s*([^\r\n]+)/m);
  if (!match) throw new Error("Could not find the catch-all CSP in source _headers");
  return match[1].trim();
}

async function jsonLdHashesForFiles(files) {
  const hashes = [];
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const blocks = extractJsonLdBlocks(html);
    if (blocks.length !== 1) {
      throw new Error(`${path.relative(OUTPUT_ROOT, file)} must contain exactly one JSON-LD block for CSP generation`);
    }
    hashes.push(sha256Source(blocks[0]));
  }
  return hashes;
}

async function generateHeaders() {
  const sourcePath = path.join(ROOT, "_headers");
  const outputPath = path.join(OUTPUT_ROOT, "_headers");
  const source = (await readFile(sourcePath, "utf8")).trimEnd();
  const globalPolicy = globalPolicyFromHeaders(source);
  const basePolicy = stripHashes(globalPolicy);
  const allHtml = (await walk(OUTPUT_ROOT)).filter((file) => file.endsWith("index.html"));
  const legacyHtml = allHtml.filter((file) => {
    const route = routeForOutputFile(file);
    return /^\/(?:ar|en)\/(?:$|[^/]+\/$)/.test(route) && !route.includes("/beauty-guide/");
  });
  const legacyHashes = await jsonLdHashesForFiles(legacyHtml);
  const configuredHashes = hashSources(globalPolicy);

  if (legacyHtml.length !== 20) throw new Error(`Expected 20 legacy canonical pages, found ${legacyHtml.length}`);
  if (new Set(configuredHashes).size !== configuredHashes.length) throw new Error("Duplicate hashes exist in the catch-all CSP");
  if (configuredHashes.length !== legacyHashes.length || configuredHashes.some((hash) => !legacyHashes.includes(hash))) {
    throw new Error("Catch-all CSP hashes do not exactly cover the 20 legacy JSON-LD blocks");
  }
  for (const stale of LEGACY_STALE_HASHES) {
    if (globalPolicy.includes(stale)) throw new Error(`Stale legacy CSP hash is still present: ${stale}`);
  }
  for (const [route, expectedHash] of Object.entries(CORRECTED_LEGACY_HASHES)) {
    const file = path.join(OUTPUT_ROOT, route.slice(1), "index.html");
    const blocks = extractJsonLdBlocks(await readFile(file, "utf8"));
    if (sha256Source(blocks[0]) !== expectedHash || !globalPolicy.includes(expectedHash)) {
      throw new Error(`Corrected legacy CSP hash is not exact for ${route}`);
    }
  }

  const scopes = [];
  for (const locale of LOCALES) {
    const homeRoute = `/${locale}/beauty-guide/`;
    scopes.push({ pattern: homeRoute, routes: [homeRoute] });
    for (const category of CATEGORY_ORDER) {
      const prefix = `/${locale}/beauty-guide/${category}/`;
      const routes = allHtml.map(routeForOutputFile).filter((route) => route.startsWith(prefix));
      scopes.push({ pattern: `${prefix}*`, routes });
    }
  }

  const generatedRules = [];
  for (const scope of scopes) {
    if (!scope.routes.length) throw new Error(`CSP scope has no generated pages: ${scope.pattern}`);
    const files = scope.routes.map((route) => path.join(OUTPUT_ROOT, route.slice(1), "index.html"));
    const hashes = await jsonLdHashesForFiles(files);
    const policy = policyWithHashes(basePolicy, hashes);
    const line = `  ${CSP_HEADER}: ${policy}`;
    if (line.length > 2000) throw new Error(`Generated CSP exceeds Cloudflare's 2,000-character line limit for ${scope.pattern}`);
    generatedRules.push(`${scope.pattern}\n  ! ${CSP_HEADER}\n${line}`);
  }

  const output = `${source}\n\n# Beauty & Care Guide CSP — generated by scripts/finalize-build.mjs\n# Guide rules detach the catch-all value, then restore the identical directives/sources with path-scoped JSON-LD hashes.\n${generatedRules.join("\n\n")}\n`;
  await writeFile(outputPath, output, "utf8");
  return { scopeCount: scopes.length, legacyHashCount: legacyHashes.length };
}

async function generateRedirects(guideData) {
  const source = (await readFile(path.join(ROOT, "_redirects"), "utf8")).trimEnd();
  const historical = [];
  for (const article of guideData.publishedArticles) {
    const lock = guideData.routeLock[article.id];
    for (const previous of lock.previous) {
      historical.push(`${previous} ${lock.current} 301`);
    }
  }
  historical.sort();
  const output = historical.length
    ? `${source}\n\n# Beauty & Care Guide published route history — generated\n${historical.join("\n")}\n`
    : `${source}\n`;
  await writeFile(path.join(OUTPUT_ROOT, "_redirects"), output, "utf8");
  return historical.length;
}

export async function finalizeBuild(explicitMode) {
  const guideData = await loadGuideData(explicitMode);
  const [headers, redirectCount] = await Promise.all([
    generateHeaders(),
    generateRedirects(guideData)
  ]);
  return { ...headers, redirectCount };
}
