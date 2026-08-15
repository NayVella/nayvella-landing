import { renderSitemap } from "./_lib/render.mjs";

export default class SitemapTemplate {
  data() {
    return {
      permalink: "/sitemap.xml",
      eleventyExcludeFromCollections: true
    };
  }

  render({ guideData }) {
    return renderSitemap(guideData);
  }
}
