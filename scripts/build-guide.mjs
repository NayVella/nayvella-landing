import { rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { OUTPUT_ROOT, ROOT, getBuildMode } from "./guide-core.mjs";
import { bundleEditorialStyles, finalizeBuild } from "./finalize-build.mjs";
import { validateGuideContent } from "./validate-guide-content.mjs";
import { verifyBuild } from "./verify-build.mjs";

function runEleventy(mode) {
  const executable = path.join(ROOT, "node_modules", "@11ty", "eleventy", "cmd.cjs");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [executable, "--config=eleventy.config.mjs"], {
      cwd: ROOT,
      env: { ...process.env, NAYVELLA_BUILD_MODE: mode },
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Eleventy exited with status ${code}`)));
  });
}

export async function buildGuide(requestedMode) {
  const mode = getBuildMode(requestedMode);
  process.env.NAYVELLA_BUILD_MODE = mode;
  if (OUTPUT_ROOT !== path.join(ROOT, "_site")) throw new Error("Refusing to clean an unexpected output directory");

  const validation = await validateGuideContent(mode);
  console.log(`Content validation passed: ${validation.articleCount} records (${validation.visibleCount} visible in ${mode}).`);
  for (const warning of validation.warnings) console.log(`Content note: ${warning}`);

  await rm(OUTPUT_ROOT, { recursive: true, force: true });
  await runEleventy(mode);
  const finalized = await finalizeBuild(mode);
  console.log(`Generated CSP: ${finalized.legacyHashCount} corrected legacy hashes and ${finalized.scopeCount} Guide path scopes.`);
  console.log(`Generated historical redirects: ${finalized.redirectCount}.`);

  const verification = await verifyBuild(mode);
  console.log(`Build verification passed: ${verification.guidePages} Guide pages, ${verification.sitemapUrls} sitemap URLs, ${verification.headerRules} header rules.`);
  await bundleEditorialStyles();
  return { mode, validation, finalized, verification };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requestedMode = process.argv[2];
  const result = await buildGuide(requestedMode);
  console.log(`NayVella Guide ${result.mode} build completed in ${OUTPUT_ROOT}.`);
}
