export default function (eleventyConfig) {
  const passthrough = [
    "ar",
    "en",
    "assets",
    "404.html",
    "favicon.png",
    "index.html",
    "llms.txt",
    "robots.txt",
    "site.webmanifest",
    "_headers",
    "_redirects"
  ];

  for (const entry of passthrough) {
    eleventyConfig.addPassthroughCopy(entry);
  }

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
