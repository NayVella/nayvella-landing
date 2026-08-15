import { renderCategoryPage } from "./_lib/render.mjs";

export default class GuideCategoryTemplate {
  data() {
    return {
      pagination: {
        data: "guideData.categoryPages",
        size: 1,
        alias: "categoryPage"
      },
      permalink: ({ categoryPage }) => `${categoryPage.route}index.html`,
      eleventyExcludeFromCollections: true
    };
  }

  render({ categoryPage, guideData }) {
    return renderCategoryPage(categoryPage, guideData);
  }
}
