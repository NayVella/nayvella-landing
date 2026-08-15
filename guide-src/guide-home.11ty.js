import { renderGuideHome } from "./_lib/render.mjs";

export default class GuideHomeTemplate {
  data() {
    return {
      pagination: {
        data: "guideData.locales",
        size: 1,
        alias: "locale"
      },
      permalink: ({ locale }) => `/${locale}/beauty-guide/index.html`,
      eleventyExcludeFromCollections: true
    };
  }

  render({ locale, guideData }) {
    return renderGuideHome(locale, guideData);
  }
}
