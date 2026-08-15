import {
  CANONICAL_ORIGIN,
  CATEGORY_ORDER,
  canonicalFor,
  categoryRoute,
  escapeHtml,
  escapeXml,
  formatDate,
  guideRoute,
  renderArticleMarkdown,
  safeJsonLd
} from "../../scripts/guide-core.mjs";

const SOCIAL_CARD = `${CANONICAL_ORIGIN}/assets/social/nayvella-social-card.png`;

const copy = {
  ar: {
    htmlLang: "ar-SA",
    dir: "rtl",
    home: "الرئيسية",
    customers: "العملاء",
    merchants: "التجار",
    clinics: "العيادات والأطباء",
    experts: "خبراء التجميل",
    guide: "دليل الجمال والعناية",
    faq: "الأسئلة الشائعة",
    pages: "الصفحات",
    legal: "قانوني",
    privacy: "سياسة الخصوصية",
    terms: "الشروط والأحكام",
    trust: "مركز الثقة",
    contact: "تواصل معنا",
    getInTouch: "تواصل معنا",
    languageLabel: "English",
    languageText: "English",
    register: "تسجيل الاهتمام",
    skip: "تجاوز إلى المحتوى الرئيسي",
    navLabel: "التنقل الرئيسي",
    menuLabel: "فتح قائمة التنقل",
    categories: "تصفحي حسب الفئة",
    categoriesIntro: "اختاري الفئة الأقرب إلى احتياجاتك الحالية.",
    featured: "أدلة مختارة وأساسية",
    latest: "أحدث الأدلة",
    seasonal: "دليل موسمي مختار",
    allArticles: "جميع الأدلة في هذه الفئة",
    moreArticles: "المزيد من الأدلة في هذه الفئة",
    pillar: "الأدلة الأساسية",
    otherCategories: "استكشفي فئات أخرى",
    readArticle: "اقرئي الدليل",
    viewCategory: "استكشفي الفئة",
    articleCategory: "الفئة",
    contents: "محتويات الدليل",
    related: "أدلة ذات صلة",
    by: "إعداد",
    published: "نُشر في",
    updated: "حُدّث في",
    draft: "مسودة للمعاينة",
    summary: "الخلاصة",
    moreGuides: "استكشفي المزيد من أدلة نيفلا",
    moreGuidesText: "واصلي تصفح المعلومات العملية حول الجمال والعناية الشخصية.",
    discover: "عرض دليل الجمال والعناية",
    infoCtaTitle: "تعرّفي أكثر على نيفلا",
    infoCtaText: "اكتشفي كيف تجمع نيفلا المعلومات والخدمات المتخصصة في تجربة واحدة.",
    infoCtaLink: "اكتشفي نيفلا",
    prelaunch: "نيفلا حالياً في مرحلة التطوير والاستعداد للإطلاق — تسجيل الاهتمام لا يعني قبولاً نهائياً أو إنشاء حساب مفعّل.",
    disclaimer: "نيفلا منصة تقنية. أي معلومات متعلقة بالجمال أو العناية بالبشرة تُعرض في هذا الموقع هي لأغراض معلوماتية عامة ولا تغني عن الاستشارة المتخصصة عند الحاجة.",
    brand: "نيفلا — من شركة ميريديان جلو",
    location: "الرياض، المملكة العربية السعودية",
    trademark: "نيفلا™ منصة وعلامة تجارية مملوكة ومشغلة من شركة ميريديان جلو.",
    copyright: "© 2026 شركة ميريديان جلو. جميع الحقوق محفوظة."
  },
  en: {
    htmlLang: "en",
    dir: "ltr",
    home: "Home",
    customers: "Customers",
    merchants: "Merchants",
    clinics: "Clinics & Doctors",
    experts: "Beauty Experts",
    guide: "Beauty & Care Guide",
    faq: "FAQ",
    pages: "Pages",
    legal: "Legal",
    privacy: "Privacy Policy",
    terms: "Terms and Conditions",
    trust: "Trust Center",
    contact: "Contact Us",
    getInTouch: "Get in Touch",
    languageLabel: "العربية",
    languageText: "العربية",
    register: "Register Your Interest",
    skip: "Skip to main content",
    navLabel: "Main navigation",
    menuLabel: "Open navigation menu",
    categories: "Browse by category",
    categoriesIntro: "Choose the category closest to your current needs.",
    featured: "Featured and pillar guides",
    latest: "Latest articles",
    seasonal: "Seasonal feature",
    allArticles: "All guides in this category",
    moreArticles: "More guides in this category",
    pillar: "Pillar guides",
    otherCategories: "Explore other categories",
    readArticle: "Read the guide",
    viewCategory: "Explore category",
    articleCategory: "Category",
    contents: "In this guide",
    related: "Related guides",
    by: "By",
    published: "Published",
    updated: "Updated",
    draft: "Preview draft",
    summary: "Summary",
    moreGuides: "Explore more NayVella guides",
    moreGuidesText: "Continue browsing practical beauty and personal-care information.",
    discover: "View the Beauty & Care Guide",
    infoCtaTitle: "Learn more about NayVella",
    infoCtaText: "Discover how NayVella brings information and specialist services into one experience.",
    infoCtaLink: "Discover NayVella",
    prelaunch: "NayVella is currently in development and preparing for launch — registering interest does not constitute final acceptance or an active account.",
    disclaimer: "NayVella is a technology platform. Any beauty or skincare information shown on this website is for general informational purposes and does not replace professional advice where applicable.",
    brand: "NayVella — By Meridian Glow Company",
    location: "Riyadh, Saudi Arabia",
    trademark: "NayVella™ is a platform and trademark owned and operated by Meridian Glow Company.",
    copyright: "© 2026 Meridian Glow Company. All rights reserved."
  }
};

function navItems(locale) {
  const t = copy[locale];
  return [
    [t.home, `/${locale}/`],
    [t.customers, `/${locale}/customers/`],
    [t.merchants, `/${locale}/merchants/`],
    [t.clinics, `/${locale}/clinics-doctors/`],
    [t.experts, `/${locale}/beauty-experts/`],
    [t.guide, guideRoute(locale)]
  ];
}

function header(locale, languageRoute) {
  const t = copy[locale];
  const desktop = navItems(locale).map(([label, href]) =>
    `<a class="nav-link${href === guideRoute(locale) ? " active" : ""}" href="${href}"${href === guideRoute(locale) ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`
  ).join("");
  const mobile = navItems(locale).map(([label, href]) =>
    `<a class="mobile-nav-link${href === guideRoute(locale) ? " active" : ""}" href="${href}"${href === guideRoute(locale) ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`
  ).join("");

  return `<header id="site-header">
<div class="header-inner">
<a aria-label="NayVella" class="logo-link nav-btn" href="/${locale}/">
<img alt="NayVella — Curated Beauty. Smarter Choices." class="logo-full" decoding="async" fetchpriority="high" height="528" src="/assets/images/nayvella-logo-primary-tagline-white.svg" width="2000">
<img alt="NayVella — Curated Beauty. Smarter Choices." class="logo-mark" decoding="async" height="322" src="/assets/images/nayvella-logo-symbol-white.svg" width="259">
</a>
<nav aria-label="${escapeHtml(t.navLabel)}" class="main-nav header-nav">${desktop}</nav>
<div class="header-actions">
<a aria-label="${escapeHtml(t.languageLabel)}" href="${languageRoute}" id="lang-toggle">${escapeHtml(t.languageText)}</a>
<a class="primary-btn header-cta nav-btn header-action" data-event="header_cta" href="/${locale}/customers/#waitlist-form"><span>${escapeHtml(t.register)}</span></a>
<button aria-controls="mobile-menu" aria-expanded="false" aria-label="${escapeHtml(t.menuLabel)}" id="burger-btn" type="button"><span></span><span></span><span></span></button>
</div>
</div>
<div class="nv-s-6aa34d7432e7" id="mobile-menu">${mobile}<a class="primary-btn nav-btn header-action header-action--mobile" href="/${locale}/customers/#waitlist-form"><span>${escapeHtml(t.register)}</span></a></div>
</header>`;
}

function footer(locale) {
  const t = copy[locale];
  const pages = navItems(locale).map(([label, href]) => `<a class="footer-link nav-btn" href="${href}">${escapeHtml(label)}</a>`).join("");
  return `<div class="prelaunch-strip">
<div class="prelaunch-inner">
<p class="body-text prelaunch-copy">${escapeHtml(t.prelaunch)}</p>
<p class="body-text prelaunch-note">${escapeHtml(t.disclaimer)}</p>
</div>
</div>
<footer id="site-footer">
<div class="footer-grid">
<div class="footer-col nv-s-583653abaf86">
<span class="nv-s-ec18faa33cae"><img alt="NayVella — Curated Beauty. Smarter Choices." class="nv-s-c0476160adac" decoding="async" height="692" loading="lazy" src="/assets/images/nayvella-brand-banner.png" width="2579"></span>
<p class="body-text footer-brand-copy"><span>${escapeHtml(t.brand)}</span><br><span>${escapeHtml(t.location)}</span></p>
</div>
<div class="footer-col"><p class="disp-font footer-h4"><span>${escapeHtml(t.pages)}</span></p>${pages}<a class="footer-link nav-btn" href="/${locale}/faq/">${escapeHtml(t.faq)}</a></div>
<div class="footer-col">
<p class="disp-font footer-h4"><span>${escapeHtml(t.legal)}</span></p>
<a class="footer-link nav-btn" href="/${locale}/privacy/">${escapeHtml(t.privacy)}</a>
<a class="footer-link nav-btn" href="/${locale}/terms/">${escapeHtml(t.terms)}</a>
<a class="footer-link nav-btn" href="/${locale}/trust-center/">${escapeHtml(t.trust)}</a>
<a class="footer-link nav-btn" href="/${locale}/contact/">${escapeHtml(t.contact)}</a>
</div>
<div class="footer-col">
<p class="disp-font footer-h4"><span>${escapeHtml(t.getInTouch)}</span></p>
<a class="footer-contact-link" dir="ltr" href="mailto:hello@meridianglow.sa" rel="noopener">hello@meridianglow.sa</a>
<a class="footer-contact-link" dir="ltr" href="mailto:partnerships@meridianglow.sa" rel="noopener">partnerships@meridianglow.sa</a>
<a class="footer-contact-link" dir="ltr" href="tel:+966114509803" rel="noopener">+966 11 450 9803</a>
<a class="footer-contact-link" dir="ltr" href="tel:+966504111020">+966 50 411 1020</a>
</div>
</div>
<div class="footer-bottom"><p class="body-text footer-meta">${escapeHtml(t.trademark)}</p><p class="body-text footer-meta">${escapeHtml(t.copyright)}</p></div>
</footer>`;
}

function organizationGraph() {
  return [
    {
      "@type": "Organization",
      "@id": `${CANONICAL_ORIGIN}/#organization`,
      name: "NayVella",
      alternateName: "نيفلا",
      url: `${CANONICAL_ORIGIN}/`,
      parentOrganization: { "@type": "Organization", name: "Meridian Glow Company" },
      address: { "@type": "PostalAddress", addressLocality: "Riyadh", addressCountry: "SA" }
    },
    {
      "@type": "WebSite",
      "@id": `${CANONICAL_ORIGIN}/#website`,
      url: `${CANONICAL_ORIGIN}/`,
      name: "NayVella",
      publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
      inLanguage: ["ar-SA", "en"]
    }
  ];
}

function breadcrumbGraph(locale, items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalFor(item.route)
    }))
  };
}

function alternateLinks(alternates, xDefaultRoute) {
  const links = alternates.map(({ locale, route }) => `<link href="${canonicalFor(route)}" hreflang="${locale}" rel="alternate">`).join("");
  return `${links}<link href="${canonicalFor(xDefaultRoute)}" hreflang="x-default" rel="alternate">`;
}

function head({ locale, title, description, route, alternates, xDefaultRoute, robots, jsonLd, pageType = "website", image = SOCIAL_CARD }) {
  const t = copy[locale];
  const canonical = canonicalFor(route);
  const hasImage = Boolean(image);
  const alternateLocale = locale === "ar" ? "en_US" : "ar_SA";
  const ogLocale = locale === "ar" ? "ar_SA" : "en_US";
  return `<head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1" name="viewport">
<title>${escapeHtml(title)}</title>
<link href="${canonical}" rel="canonical">
<meta content="${escapeHtml(description)}" name="description">
<link href="/favicon.png" rel="icon" sizes="64x64" type="image/png">
<link href="/assets/icons/apple-touch-icon.png" rel="apple-touch-icon">
<meta content="${pageType}" property="og:type">
<meta content="${escapeHtml(title)}" property="og:title">
<meta content="${escapeHtml(description)}" property="og:description">
<meta content="${canonical}" property="og:url">
${hasImage ? `<meta content="${escapeHtml(image)}" property="og:image">` : ""}
<meta content="${ogLocale}" property="og:locale">
<meta content="${alternateLocale}" property="og:locale:alternate">
<meta content="${hasImage ? "summary_large_image" : "summary"}" name="twitter:card">
<meta content="${escapeHtml(title)}" name="twitter:title">
<meta content="${escapeHtml(description)}" name="twitter:description">
${hasImage ? `<meta content="${escapeHtml(image)}" name="twitter:image">` : ""}
<meta content="${robots}" name="robots">
<link href="/site.webmanifest" rel="manifest">
${alternateLinks(alternates, xDefaultRoute)}
<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>
<link href="/assets/css/site.css?v=beauty-guide-phase-1-20260815" rel="stylesheet">
<link href="/assets/css/footer-hotfix-20260726.css" rel="stylesheet">
<link href="/assets/css/content-ui-correction-20260727.css" rel="stylesheet">
<link href="/assets/css/header-cta-contrast-20260727.css" rel="stylesheet">
<link href="/assets/css/beauty-guide.css?v=phase-1" rel="stylesheet">
</head>`;
}

function pageShell({ locale, languageRoute, headHtml, mainHtml }) {
  const t = copy[locale];
  return `<!DOCTYPE html>
<html dir="${t.dir}" lang="${t.htmlLang}" data-lang="${locale}">
${headHtml}
<body data-template="beauty-guide"><a class="skip-link" href="#main-content">${escapeHtml(t.skip)}</a>
${header(locale, languageRoute)}
<main id="main-content" tabindex="-1">${mainHtml}</main>
${footer(locale)}
<script defer src="/assets/js/navigation-hotfix-20260726.js"></script><script defer src="/assets/js/site.js?v=footer-hotfix-20260726"></script>
</body>
</html>`;
}

function breadcrumbs(locale, items) {
  const t = copy[locale];
  return `<nav aria-label="${locale === "ar" ? "مسار الصفحة" : "Breadcrumb"}" class="guide-breadcrumb"><ol>${items.map((item, index) => {
    const current = index === items.length - 1;
    return `<li>${current ? `<span aria-current="page">${escapeHtml(item.name)}</span>` : `<a href="${item.route}">${escapeHtml(item.name)}</a>`}</li>`;
  }).join("")}</ol></nav>`;
}

function articleCard(article, locale, options = {}) {
  const t = copy[locale];
  const categoryName = options.categoryName || "";
  return `<article class="guide-card glass-card${options.featured ? " guide-card--featured" : ""}">
<div class="guide-card-meta">${categoryName ? `<span>${escapeHtml(categoryName)}</span>` : ""}${article.status === "Draft" ? `<span class="guide-status">${escapeHtml(t.draft)}</span>` : ""}</div>
<h3 class="disp-font"><a href="${article.route}">${escapeHtml(article.title)}</a></h3>
<p class="body-text">${escapeHtml(article.excerpt)}</p>
<a class="guide-card-link" href="${article.route}">${escapeHtml(t.readArticle)} <span aria-hidden="true">→</span></a>
</article>`;
}

function categoryCard(category, meta, locale) {
  const t = copy[locale];
  return `<article class="guide-category-card glass-card">
<h3 class="disp-font"><a href="${categoryRoute(locale, category)}">${escapeHtml(meta.h1)}</a></h3>
<p class="body-text">${escapeHtml(meta.intro)}</p>
<a class="guide-card-link" href="${categoryRoute(locale, category)}">${escapeHtml(t.viewCategory)} <span aria-hidden="true">→</span></a>
</article>`;
}

function infoCta(locale, articlePage = false) {
  const t = copy[locale];
  const href = articlePage ? guideRoute(locale) : `/${locale}/customers/`;
  return `<section class="guide-cta"><div class="content-container guide-cta-inner">
<div><h2 class="disp-font">${escapeHtml(articlePage ? t.moreGuides : t.infoCtaTitle)}</h2><p class="body-text">${escapeHtml(articlePage ? t.moreGuidesText : t.infoCtaText)}</p></div>
<a class="primary-btn" href="${href}">${escapeHtml(articlePage ? t.discover : t.infoCtaLink)}</a>
</div></section>`;
}

export function renderGuideHome(locale, guideData) {
  const t = copy[locale];
  const meta = guideData.guide[locale];
  const route = guideRoute(locale);
  const otherLocale = locale === "ar" ? "en" : "ar";
  const localeArticles = guideData.visibleArticles.filter((article) => article.language === locale);
  const featured = localeArticles.filter((article) => article.is_featured);
  const latest = [...localeArticles].sort((a, b) => b.translation_group_id.localeCompare(a.translation_group_id)).slice(0, 6);
  const seasonal = localeArticles.find((article) => article.is_seasonal_featured);
  const breadcrumbItems = [{ name: t.home, route: `/${locale}/` }, { name: meta.h1, route }];
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      ...organizationGraph(),
      {
        "@type": "CollectionPage",
        "@id": `${canonicalFor(route)}#webpage`,
        url: canonicalFor(route),
        name: meta.seo_title,
        description: meta.meta_description,
        isPartOf: { "@id": `${CANONICAL_ORIGIN}/#website` },
        about: { "@id": `${CANONICAL_ORIGIN}/#organization` },
        inLanguage: t.htmlLang
      },
      breadcrumbGraph(locale, breadcrumbItems)
    ]
  };
  const headHtml = head({
    locale,
    title: meta.seo_title,
    description: meta.meta_description,
    route,
    alternates: [{ locale: "ar", route: guideRoute("ar") }, { locale: "en", route: guideRoute("en") }],
    xDefaultRoute: guideRoute("ar"),
    robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
    jsonLd: graph
  });
  const mainHtml = `<section class="guide-hero page-hero page-hero--compact"><div class="page-hero-inner"><p class="guide-kicker">NayVella</p><h1 class="disp-font page-hero-title">${escapeHtml(meta.h1)}</h1><p class="body-text page-hero-copy">${escapeHtml(meta.intro)}</p></div></section>
<section class="content-container guide-section"><div class="guide-section-heading"><div><h2 class="disp-font">${escapeHtml(t.categories)}</h2><p class="body-text">${escapeHtml(t.categoriesIntro)}</p></div></div><div class="guide-category-grid">${CATEGORY_ORDER.map((category) => categoryCard(category, guideData.categories[category][locale], locale)).join("")}</div></section>
<section class="guide-section guide-section--tinted"><div class="content-container"><div class="guide-section-heading"><h2 class="disp-font">${escapeHtml(t.featured)}</h2></div><div class="guide-card-grid">${featured.map((article) => articleCard(article, locale, { featured: true, categoryName: guideData.categories[article.category][locale].name })).join("")}</div></div></section>
<section class="content-container guide-section"><div class="guide-section-heading"><h2 class="disp-font">${escapeHtml(t.latest)}</h2></div><div class="guide-card-grid">${latest.map((article) => articleCard(article, locale, { categoryName: guideData.categories[article.category][locale].name })).join("")}</div></section>
${seasonal ? `<section class="guide-section guide-section--seasonal"><div class="content-container"><div class="guide-section-heading"><h2 class="disp-font">${escapeHtml(t.seasonal)}</h2></div><div class="guide-feature-single">${articleCard(seasonal, locale, { featured: true, categoryName: guideData.categories[seasonal.category][locale].name })}</div></div></section>` : ""}
${infoCta(locale)}`;
  return pageShell({ locale, languageRoute: guideRoute(otherLocale), headHtml, mainHtml });
}

export function renderCategoryPage(page, guideData) {
  const { locale, category, meta, route } = page;
  const t = copy[locale];
  const otherLocale = locale === "ar" ? "en" : "ar";
  const articles = guideData.visibleArticles.filter((article) => article.language === locale && article.category === category);
  const pillar = articles.find((article) => article.is_pillar && !article.pillar_article_id)
    || articles.find((article) => article.is_pillar)
    || null;
  const others = pillar ? articles.filter((article) => article.id !== pillar.id) : articles;
  const title = `${meta.h1} | ${locale === "ar" ? "دليل نيفلا" : "NayVella Guide"}`;
  const breadcrumbItems = [{ name: t.home, route: `/${locale}/` }, { name: t.guide, route: guideRoute(locale) }, { name: meta.h1, route }];
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      ...organizationGraph(),
      {
        "@type": "CollectionPage",
        "@id": `${canonicalFor(route)}#webpage`,
        url: canonicalFor(route),
        name: title,
        description: meta.intro,
        isPartOf: { "@id": `${CANONICAL_ORIGIN}/#website` },
        inLanguage: t.htmlLang
      },
      breadcrumbGraph(locale, breadcrumbItems)
    ]
  };
  const headHtml = head({
    locale,
    title,
    description: meta.intro,
    route,
    alternates: [{ locale: "ar", route: categoryRoute("ar", category) }, { locale: "en", route: categoryRoute("en", category) }],
    xDefaultRoute: categoryRoute("ar", category),
    robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
    jsonLd: graph
  });
  const otherCategoryLinks = CATEGORY_ORDER.filter((id) => id !== category).map((id) => `<a href="${categoryRoute(locale, id)}">${escapeHtml(guideData.categories[id][locale].name)}</a>`).join("");
  const mainHtml = `<div class="content-container guide-breadcrumb-wrap">${breadcrumbs(locale, breadcrumbItems)}</div>
<section class="guide-hero guide-hero--category page-hero page-hero--compact"><div class="page-hero-inner"><p class="guide-kicker">${escapeHtml(t.guide)}</p><h1 class="disp-font page-hero-title">${escapeHtml(meta.h1)}</h1><p class="body-text page-hero-copy">${escapeHtml(meta.intro)}</p></div></section>
${pillar ? `<section class="guide-section guide-section--tinted"><div class="content-container"><div class="guide-section-heading"><h2 class="disp-font">${escapeHtml(t.pillar)}</h2></div><div class="guide-feature-single">${articleCard(pillar, locale, { featured: true })}</div></div></section>` : ""}
<section class="content-container guide-section"><div class="guide-section-heading"><h2 class="disp-font">${escapeHtml(pillar ? t.moreArticles : t.allArticles)}</h2></div><div class="guide-card-grid">${others.map((article) => articleCard(article, locale)).join("")}</div></section>
<section class="content-container guide-other-categories"><h2 class="disp-font">${escapeHtml(t.otherCategories)}</h2><div>${otherCategoryLinks}</div></section>
${infoCta(locale)}`;
  return pageShell({ locale, languageRoute: categoryRoute(otherLocale, category), headHtml, mainHtml });
}

export function renderArticlePage(article, guideData) {
  const locale = article.language;
  const t = copy[locale];
  const categoryMeta = guideData.categories[article.category][locale];
  const counterpartLocale = locale === "ar" ? "en" : "ar";
  const counterpart = guideData.resolveLocalized(article.translation_group_id, counterpartLocale, true);
  const arabicPublished = guideData.resolveLocalized(article.translation_group_id, "ar", true);
  const translatedPublished = guideData.resolveLocalized(article.translation_group_id, counterpartLocale, true);
  const alternates = [{ locale, route: article.route }];
  if (translatedPublished) alternates.push({ locale: counterpartLocale, route: translatedPublished.route });
  alternates.sort((a, b) => a.locale.localeCompare(b.locale));
  const xDefaultRoute = arabicPublished?.route || article.route;
  const { introHtml, bodyHtml, toc } = renderArticleMarkdown(article, guideData);
  const related = article.related_article_ids.map((id) => guideData.resolveLocalized(id, locale, true)).filter(Boolean);
  const breadcrumbItems = [
    { name: t.home, route: `/${locale}/` },
    { name: t.guide, route: guideRoute(locale) },
    { name: categoryMeta.name, route: categoryRoute(locale, article.category) },
    { name: article.title, route: article.route }
  ];
  const title = article.seo_title || article.title;
  const description = article.meta_description || article.excerpt;
  const articleGraph = {
    "@type": "BlogPosting",
    "@id": `${article.canonical}#article`,
    mainEntityOfPage: { "@id": `${article.canonical}#webpage` },
    headline: article.title,
    description,
    author: { "@type": "Organization", name: article.author },
    publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
    articleSection: categoryMeta.name,
    inLanguage: t.htmlLang,
    ...(article.hero_image ? { image: `${CANONICAL_ORIGIN}${article.hero_image}` } : {}),
    ...(article.published_at ? { datePublished: article.published_at } : {}),
    ...(article.updated_at ? { dateModified: article.updated_at } : {})
  };
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      ...organizationGraph(),
      {
        "@type": "WebPage",
        "@id": `${article.canonical}#webpage`,
        url: article.canonical,
        name: title,
        description,
        isPartOf: { "@id": `${CANONICAL_ORIGIN}/#website` },
        inLanguage: t.htmlLang
      },
      articleGraph,
      breadcrumbGraph(locale, breadcrumbItems)
    ]
  };
  const robots = article.status === "Published"
    ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    : "noindex,nofollow";
  const headHtml = head({
    locale,
    title,
    description,
    route: article.route,
    alternates,
    xDefaultRoute,
    robots,
    jsonLd: graph,
    pageType: "article",
    image: article.hero_image ? `${CANONICAL_ORIGIN}${article.hero_image}` : null
  });
  const dateParts = [
    article.published_at ? `<span>${escapeHtml(t.published)} <time datetime="${escapeHtml(article.published_at)}">${escapeHtml(formatDate(article.published_at, locale))}</time></span>` : "",
    article.updated_at ? `<span>${escapeHtml(t.updated)} <time datetime="${escapeHtml(article.updated_at)}">${escapeHtml(formatDate(article.updated_at, locale))}</time></span>` : ""
  ].filter(Boolean).join("");
  const heroDimensions = `${article.hero_image_width ? ` width="${Number(article.hero_image_width)}"` : ""}${article.hero_image_height ? ` height="${Number(article.hero_image_height)}"` : ""}`;
  const tocHtml = toc.length ? `<nav aria-label="${escapeHtml(t.contents)}" class="guide-toc"><h2 class="disp-font">${escapeHtml(t.contents)}</h2><ol>${toc.map((item) => `<li class="guide-toc-level-${item.level}"><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`).join("")}</ol></nav>` : "";
  const mainHtml = `<div class="content-container guide-breadcrumb-wrap">${breadcrumbs(locale, breadcrumbItems)}</div>
<article class="guide-article">
<header class="reading-container guide-article-header"><a class="guide-category-label" href="${categoryRoute(locale, article.category)}">${escapeHtml(categoryMeta.name)}</a><h1 class="disp-font">${escapeHtml(article.title)}</h1><div class="guide-article-intro body-text">${introHtml}</div><div class="guide-article-meta"><span>${escapeHtml(t.by)} ${escapeHtml(article.author)}</span>${dateParts}${article.status === "Draft" ? `<span class="guide-status">${escapeHtml(t.draft)}</span>` : ""}</div></header>
${article.hero_image ? `<figure class="reading-container guide-hero-image"><img alt="${escapeHtml(article.hero_image_alt)}" decoding="async" fetchpriority="high" src="${escapeHtml(article.hero_image)}"${heroDimensions}>${article.hero_image_caption ? `<figcaption>${escapeHtml(article.hero_image_caption)}</figcaption>` : ""}</figure>` : ""}
<div class="reading-container guide-article-layout">${tocHtml}<div class="guide-article-body body-text">${bodyHtml}</div>${article.summary ? `<aside class="guide-summary"><h2 class="disp-font">${escapeHtml(t.summary)}</h2><p>${escapeHtml(article.summary)}</p></aside>` : ""}</div>
</article>
${related.length ? `<section class="guide-section guide-section--tinted"><div class="content-container"><div class="guide-section-heading"><h2 class="disp-font">${escapeHtml(t.related)}</h2></div><div class="guide-card-grid">${related.map((item) => articleCard(item, locale, { categoryName: guideData.categories[item.category][locale].name })).join("")}</div></div></section>` : ""}
${infoCta(locale, true)}`;
  return pageShell({ locale, languageRoute: counterpart?.route || guideRoute(counterpartLocale), headHtml, mainHtml });
}

function sitemapAlternates(entries, xDefaultRoute) {
  return `${entries.map(({ locale, route }) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(canonicalFor(route))}"/>`).join("")}<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(canonicalFor(xDefaultRoute))}"/>`;
}

export function renderSitemap(guideData) {
  const generated = [];
  for (const locale of ["ar", "en"]) {
    const route = guideRoute(locale);
    generated.push(`<url><loc>${canonicalFor(route)}</loc>${sitemapAlternates([{ locale: "ar", route: guideRoute("ar") }, { locale: "en", route: guideRoute("en") }], guideRoute("ar"))}</url>`);
    for (const category of CATEGORY_ORDER) {
      const categoryPath = categoryRoute(locale, category);
      generated.push(`<url><loc>${canonicalFor(categoryPath)}</loc>${sitemapAlternates([{ locale: "ar", route: categoryRoute("ar", category) }, { locale: "en", route: categoryRoute("en", category) }], categoryRoute("ar", category))}</url>`);
    }
  }
  for (const article of guideData.publishedArticles) {
    const counterpartLocale = article.language === "ar" ? "en" : "ar";
    const counterpart = guideData.resolveLocalized(article.translation_group_id, counterpartLocale, true);
    const arabic = guideData.resolveLocalized(article.translation_group_id, "ar", true);
    const alternates = [{ locale: article.language, route: article.route }];
    if (counterpart) alternates.push({ locale: counterpartLocale, route: counterpart.route });
    alternates.sort((a, b) => a.locale.localeCompare(b.locale));
    const lastmod = article.updated_at || article.published_at;
    generated.push(`<url><loc>${article.canonical}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}${sitemapAlternates(alternates, arabic?.route || article.route)}</url>`);
  }
  const legacy = guideData.legacySitemap.map((entry) => `  <url>${entry}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${legacy}\n  ${generated.join("\n  ")}\n</urlset>\n`;
}
