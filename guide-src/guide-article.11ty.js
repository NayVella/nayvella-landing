import { renderArticlePage } from "./_lib/render.mjs";

export default class GuideArticleTemplate {
  data() {
    return {
      pagination: {
        data: "guideData.visibleArticles",
        size: 1,
        alias: "article"
      },
      permalink: ({ article }) => `${article.route}index.html`,
      eleventyExcludeFromCollections: true
    };
  }

  render({ article, guideData }) {
    return renderArticlePage(article, guideData);
  }
}
