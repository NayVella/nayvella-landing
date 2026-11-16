// Metadata only: the platform is a brand; its owner publishes the website.
const ORIGIN = 'https://nayvella.com';
export const IDS = Object.freeze({
  owner: `${ORIGIN}/#owner`, brand: `${ORIGIN}/#brand`, website: `${ORIGIN}/#website`
});
export function identityGraph() {
  return [
    { '@type': 'Organization', '@id': IDS.owner, name: 'Meridian Glow Company',
      alternateName: 'شركة ميريديان جلو', url: 'https://meridianglow.sa/',
      brand: { '@id': IDS.brand },
      address: { '@type': 'PostalAddress', addressLocality: 'Riyadh', addressCountry: 'SA' } },
    { '@type': 'Brand', '@id': IDS.brand, name: 'NayVella', alternateName: 'نيفلا', url: `${ORIGIN}/` },
    { '@type': 'WebSite', '@id': IDS.website, url: `${ORIGIN}/`, name: 'NayVella', alternateName: 'نيفلا',
      publisher: { '@id': IDS.owner }, about: { '@id': IDS.brand }, inLanguage: ['ar-SA', 'en'] }
  ];
}
export function enrichDiscoveryGraph(input, { canonical, alternates }) {
  const graph = structuredClone(input);
  graph['@graph'] = graph['@graph'].filter(n => !['Organization', 'Brand', 'WebSite'].includes(n['@type']));
  graph['@graph'].unshift(...identityGraph());
  const page = graph['@graph'].find(n => n['@id'] === `${canonical}#webpage`);
  if (!page) throw new Error(`Missing WebPage identity: ${canonical}`);
  page.about = { '@id': IDS.brand };
  const translations = alternates.filter(a => a.url !== canonical).map(a => ({ '@id': `${a.url}#webpage` }));
  if (translations.length) page.workTranslation = translations;
  const breadcrumb = graph['@graph'].find(n => n['@type'] === 'BreadcrumbList');
  if (breadcrumb) {
    breadcrumb['@id'] = `${canonical}#breadcrumb`;
    page.breadcrumb = { '@id': breadcrumb['@id'] };
  }
  const faq = graph['@graph'].find(n => n['@type'] === 'FAQPage' && n !== page);
  if (faq) {
    page['@type'] = [...new Set([...[page['@type']].flat(), 'FAQPage'])];
    page.mainEntity = faq.mainEntity;
    graph['@graph'] = graph['@graph'].filter(n => n !== faq);
  }
  const article = graph['@graph'].find(n => n['@type'] === 'BlogPosting');
  if (article) {
    article.publisher = { '@id': IDS.owner };
    page.mainEntity = { '@id': article['@id'] };
    const articleTranslations = alternates.filter(a => a.url !== canonical).map(a => ({ '@id': `${a.url}#article` }));
    if (articleTranslations.length) article.workTranslation = articleTranslations;
  }
  return graph;
}
