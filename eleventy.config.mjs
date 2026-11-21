import { readdirSync } from 'node:fs';

export default function (eleventyConfig) {
  const passthrough = [
    "ar",
    "en",
    "404.html",
    "favicon.png",
    "index.html",
    "en.html",
    "llms.txt",
    "robots.txt",
    "site.webmanifest",
    "_headers",
    "_redirects"
  ];

  for (const entry of passthrough) {
    eleventyConfig.addPassthroughCopy(entry);
  }

  // Keep original reference screenshots in source, outside the publishable output.
  function copyPublicAssets(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = `${directory}/${entry.name}`;
      if (target === 'assets/images/app-preview') continue;
      // The pearl stylesheet is bundled with platform-ui.css during finalization.
      if (target === 'assets/css/identity-pearl.css') continue;
      if (entry.isDirectory()) copyPublicAssets(target);
      else if (entry.isFile()) eleventyConfig.addPassthroughCopy(target);
    }
  }
  copyPublicAssets('assets');

  return {
    dir: {
      input: "guide-src",
      output: "_site"
    },
    htmlTemplateEngine: false,
    markdownTemplateEngine: false,
    templateFormats: ["11ty.js"]
  };
}
