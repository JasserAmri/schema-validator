// services/contentAnalysis.js
// Content analysis functions for AEO, breadcrumbs, performance, and meta consistency

const cheerio = require('cheerio');
const { cleanJsonLikeString } = require('../utils/stringUtils');
const { isAbsolute, absolutize } = require('../utils/urlUtils');
const { fleschKincaidReadingEase } = require('../utils/readabilityUtils');
const { normalizeType } = require('../utils/schemaUtils');

// -------------------------------------
// FAQ / HowTo Schema Analysis
// -------------------------------------
function analyzeFaqHowToSchema(allSchemas) {
  const analysis = {
    exists: false, score: 0, maxScore: 100,
    issues: [], recommendations: [],
    faqQuality: 0, howToQuality: 0, totalQuestions: 0, totalSteps: 0,
    featuredSnippetPotential: 'low',
    faqPages: []
  };

  const faqSchemas = allSchemas.filter(s => normalizeType(s['@type']).toLowerCase().includes('faqpage'));
  const howToSchemas = allSchemas.filter(s => normalizeType(s['@type']).toLowerCase().includes('howto'));

  analysis.exists = faqSchemas.length > 0 || howToSchemas.length > 0;

  // FAQ scoring
  faqSchemas.forEach(item => {
    const mainEntity = item.mainEntity;
    if (Array.isArray(mainEntity)) {
      analysis.totalQuestions += mainEntity.length;
      mainEntity.forEach(q => {
        const qname = q?.name || q?.headline || '';
        const ans = q?.acceptedAnswer?.text || '';
        if (qname && qname.length > 20) analysis.faqQuality += 10;
        if (ans) {
          const len = ans.replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
          if (len > 100) analysis.faqQuality += 15;
          else if (len > 50) analysis.faqQuality += 10;
          else analysis.recommendations.push('Provide more detailed FAQ answers (50+ words).');
        } else {
          analysis.issues.push('FAQ question missing acceptedAnswer.text');
        }
      });
    } else {
      analysis.issues.push('FAQPage without mainEntity array.');
    }
  });

  // HowTo scoring
  howToSchemas.forEach(item => {
    const steps = item.step;
    if (Array.isArray(steps)) {
      analysis.totalSteps += steps.length;
      steps.forEach(st => {
        const txt = st?.text || st?.description || '';
        if (txt) {
          const len = String(txt).replace(/<[^>]*>/g, '').trim().length;
          analysis.howToQuality += (len > 30 ? 15 : 8);
        } else {
          analysis.issues.push('HowTo step missing text/description');
        }
      });
      if (item.name && item.description) analysis.howToQuality += 10;
    } else {
      analysis.issues.push('HowTo missing step array.');
    }
  });

  // Overall score
  const totalItems = analysis.totalQuestions + analysis.totalSteps;
  if (totalItems > 0) {
    analysis.score += 30; // has content
    if (analysis.faqQuality > 50 || analysis.howToQuality > 50) analysis.score += 25;
    if (totalItems > 5) analysis.score += 20;
    else if (totalItems > 2) analysis.score += 10;
    if (analysis.totalQuestions > 0) analysis.score += 15;
    if (analysis.totalSteps > 0) analysis.score += 10;
  } else {
    analysis.recommendations.push('Add FAQ or HowTo schema with multiple entries.');
  }

  // Featured snippet potential
  if (analysis.faqQuality > 70 && analysis.totalQuestions > 3) analysis.featuredSnippetPotential = 'high';
  else if (analysis.faqQuality > 40 && analysis.totalQuestions > 1) analysis.featuredSnippetPotential = 'medium';

  if (faqSchemas.length === 0) analysis.recommendations.push('Add FAQPage schema for common questions.');

  return analysis;
}

// -------------------------------------
// Breadcrumb Analysis
// -------------------------------------
function analyzeBreadcrumbs($, pageUrl) {
  const analysis = { exists: false, score: 0, maxScore: 100, issues: [], recommendations: [], breadcrumbType: null, depth: 0, structured: false, accurate: false };

  // JSON-LD breadcrumbs
  let jsonLdBreadcrumbs = null;
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const content = cleanJsonLikeString($(el).html() || '');
      const parsed = JSON.parse(content);
      const nodes = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
      nodes.forEach(n => {
        if (n && n['@type'] === 'BreadcrumbList') jsonLdBreadcrumbs = n;
      });
    } catch {}
  });

  if (jsonLdBreadcrumbs) {
    analysis.exists = true;
    analysis.breadcrumbType = 'JSON-LD';
    analysis.structured = true;
    const items = jsonLdBreadcrumbs.itemListElement || [];
    analysis.depth = items.length;
    if (items.length > 0) analysis.score += 40;
    if (items.length >= 3) analysis.score += 15;
    items.forEach((it, idx) => {
      if (it.position === idx + 1 && it.name && (it.item || it.item?.['@id'])) analysis.score += 5;
      else analysis.issues.push(`Breadcrumb item ${idx + 1} missing position/name/item`);
    });
    analysis.accurate = true; // heuristic; real path compare would be heavier
    analysis.score += 10;
  }

  // Microdata/HTML breadcrumbs fallback
  const micro = $('[itemtype*="BreadcrumbList"], nav[aria-label*="breadcrumb"], .breadcrumb, [class*="breadcrumb"]');
  if (!analysis.exists && micro.length > 0) {
    analysis.exists = true;
    analysis.breadcrumbType = 'Microdata/HTML';
    analysis.depth = micro.find('li,[itemprop="itemListElement"]').length;
    analysis.score += 35;
    if (analysis.depth >= 3) analysis.score += 10;
  }

  if (!analysis.exists) {
    analysis.issues.push('No breadcrumb navigation found.');
    analysis.recommendations.push('Add JSON-LD BreadcrumbList for better SEO.');
  }
  return analysis;
}

// -------------------------------------
// Content Structure Analysis
// -------------------------------------
function analyzeContentStructure($) {
  const analysis = { score: 0, maxScore: 100, issues: [], recommendations: [], headerHierarchy: {}, paragraphStats: {}, contentDensity: 'unknown', readabilityScore: 0 };

  const headers = {};
  for (let i = 1; i <= 6; i++) {
    const count = $(`h${i}`).length;
    headers[`h${i}`] = count;
    if (count > 0) analysis.score += 5;
  }
  if (headers.h1 === 1) analysis.score += 15;
  else if (headers.h1 === 0) analysis.issues.push('Missing H1 tag.');
  else analysis.issues.push('Multiple H1 tags detected.');

  if (headers.h1 > 0 && headers.h2 > 0) analysis.score += 10;
  if (headers.h2 > 0 && headers.h3 > 0) analysis.score += 5;
  analysis.headerHierarchy = headers;

  const paragraphs = $('p').map((i, p) => $(p).text().trim()).get().filter(Boolean);
  const lengths = paragraphs.map(t => t.length);
  const avg = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0;
  analysis.paragraphStats = {
    count: paragraphs.length,
    averageLength: avg,
    minLength: lengths.length ? Math.min(...lengths) : 0,
    maxLength: lengths.length ? Math.max(...lengths) : 0
  };
  if (paragraphs.length > 0) analysis.score += 10;
  if (avg > 100) analysis.score += 10; else if (avg < 50) analysis.recommendations.push('Consider longer paragraphs (100+ chars).');

  const lists = $('ul,ol');
  if (lists.length > 0) {
    analysis.score += 10;
    lists.each((i, el) => { if ($(el).find('li').length > 2) analysis.score += 5; });
  } else {
    analysis.recommendations.push('Add bullet/numbered lists where helpful.');
  }

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const len = bodyText.length;
  if (len > 1000) { analysis.contentDensity = 'comprehensive'; analysis.score += 15; }
  else if (len > 500) { analysis.contentDensity = 'good'; analysis.score += 10; }
  else if (len > 200) { analysis.contentDensity = 'basic'; analysis.score += 5; }
  else analysis.issues.push('Very short content on page.');

  analysis.readabilityScore = fleschKincaidReadingEase(bodyText);
  if (analysis.readabilityScore >= 70) analysis.score += 10;
  else if (analysis.readabilityScore >= 50) analysis.score += 5;

  return analysis;
}

// -------------------------------------
// Performance Analysis
// -------------------------------------
function analyzePerformance($, html, url) {
  const analysis = {
    score: 0, maxScore: 100, issues: [], recommendations: [],
    coreWebVitals: {
      LCP: { value: '0s', score: 0, status: 'unknown' },
      FID: { value: '0ms', score: 0, status: 'unknown' },
      CLS: { value: '0', score: 0, status: 'unknown' }
    },
    pageSpeed: { loadTime: 'unknown', size: `${Math.round((html.length || 0) / 1024)}KB`, requests: 0, score: 0 },
    mobileFriendly: false,
    technicalSEO: { brokenLinks: 0, redirects: 0, statusCodes: {}, score: 0, canonicalFound: false, internalLinks: 0 }
  };

  const images = $('img').length;
  const scripts = $('script').length;
  const styles = $('link[rel="stylesheet"]').length;
  analysis.pageSpeed.requests = images + scripts + styles;

  const size = html.length;
  if (size < 50000) { analysis.pageSpeed.score += 25; analysis.pageSpeed.loadTime = '< 1s'; }
  else if (size < 100000) { analysis.pageSpeed.score += 15; analysis.pageSpeed.loadTime = '1-2s'; }
  else if (size < 200000) { analysis.pageSpeed.score += 10; analysis.pageSpeed.loadTime = '2-3s'; }
  else { analysis.pageSpeed.loadTime = '> 3s'; analysis.issues.push('Large HTML size; consider compression/trim.'); }

  if (analysis.pageSpeed.requests < 20) analysis.pageSpeed.score += 25;
  else if (analysis.pageSpeed.requests < 50) analysis.pageSpeed.score += 15;
  else if (analysis.pageSpeed.requests < 100) analysis.pageSpeed.score += 5;
  else analysis.issues.push('Too many resources; consider lazy-load and bundling.');

  // LCP estimate
  if (images === 0) { analysis.coreWebVitals.LCP = { value: '1.2s', score: 90, status: 'good' }; analysis.score += 15; }
  else if (images <= 5) { analysis.coreWebVitals.LCP = { value: '2.1s', score: 75, status: 'needs-improvement' }; analysis.score += 10; }
  else { analysis.coreWebVitals.LCP = { value: '3.8s', score: 40, status: 'poor' }; analysis.issues.push('Many images may worsen LCP; optimize.'); }

  // FID estimate
  if (scripts <= 3) { analysis.coreWebVitals.FID = { value: '45ms', score: 95, status: 'good' }; analysis.score += 15; }
  else if (scripts <= 8) { analysis.coreWebVitals.FID = { value: '120ms', score: 65, status: 'needs-improvement' }; analysis.score += 8; }
  else { analysis.coreWebVitals.FID = { value: '280ms', score: 30, status: 'poor' }; analysis.issues.push('Heavy JS can worsen FID; defer/split.'); }

  // CLS estimate
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const fixedDims = $('img[width][height], [style*="width"][style*="height"]').length;
  if (hasViewport && fixedDims > 0) { analysis.coreWebVitals.CLS = { value: '0.05', score: 95, status: 'good' }; analysis.score += 15; }
  else if (hasViewport) { analysis.coreWebVitals.CLS = { value: '0.15', score: 65, status: 'needs-improvement' }; analysis.score += 8; }
  else { analysis.coreWebVitals.CLS = { value: '0.35', score: 20, status: 'poor' }; analysis.issues.push('Missing viewport meta; critical for mobile.'); }

  analysis.mobileFriendly = hasViewport;
  if (analysis.mobileFriendly) { analysis.score += 15; analysis.technicalSEO.score += 20; }
  else analysis.recommendations.push('Add <meta name="viewport" content="width=device-width, initial-scale=1.0">');

  if ($('meta[name="theme-color"]').length > 0) { analysis.score += 5; analysis.technicalSEO.score += 10; }
  if ($('link[rel="manifest"]').length > 0) { analysis.score += 5; analysis.technicalSEO.score += 10; }

  // Structured data density
  const jsonLdCount = $('script[type="application/ld+json"]').length;
  const microCount = $('[itemscope]').length;
  const rdfaCount = $('[typeof]').length;
  if (jsonLdCount > 0 || microCount > 0 || rdfaCount > 0) { analysis.technicalSEO.score += 20; analysis.score += 10; }
  else analysis.issues.push('No structured data found.');

  // Suggestions
  if (scripts > 5) analysis.recommendations.push('Reduce JS files or split/defer to improve interactivity.');
  if (styles > 3) analysis.recommendations.push('Combine CSS or use critical CSS.');
  if (images > 10) analysis.recommendations.push('Use compression and lazy-loading for images.');

  return analysis;
}

// -------------------------------------
// Meta Consistency Analysis
// -------------------------------------
function analyzeMetaConsistency($, pageSchemas) {
  const res = { score: 0, maxScore: 100, issues: [], recommendations: [], details: {} };
  const title = $('title').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';

  // Attempt to find primary schema "name"
  const primary = pageSchemas.find(s => /Hotel|LocalBusiness|Organization|Product|Article/i.test(String(s['@type'])));
  const schemaName = primary?.name || '';

  res.details = { title, metaDesc, ogTitle, ogDesc, schemaName };

  let points = 0;
  if (title && schemaName && title.toLowerCase().includes(schemaName.toLowerCase())) points += 25;
  if (metaDesc && ogDesc && metaDesc.slice(0, 60) === ogDesc.slice(0, 60)) points += 15; // similar starts
  if (ogTitle && title && ogTitle.slice(0, 50) === title.slice(0, 50)) points += 15;

  res.score = points;
  if (!schemaName) res.recommendations.push('Primary entity missing a clear name.');
  if (!metaDesc) res.recommendations.push('Add <meta name="description">');
  if (!ogTitle || !ogDesc) res.recommendations.push('Add OpenGraph title/description for consistency.');
  return res;
}

// -------------------------------------
// Canonical / OG URL Alignment
// -------------------------------------
function analyzeCanonicalOgAlignment($, pageUrl) {
  const res = { score: 0, maxScore: 100, issues: [], recommendations: [], details: {} };
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const ogUrl = $('meta[property="og:url"]').attr('content') || '';

  const resolvedCanonical = canonical ? absolutize(canonical, pageUrl) : '';
  const resolvedOg = ogUrl ? absolutize(ogUrl, pageUrl) : '';

  res.details = { canonical: resolvedCanonical, ogUrl: resolvedOg, pageUrl };

  let points = 0;
  if (resolvedCanonical && resolvedOg && resolvedCanonical === resolvedOg) points += 40;
  if (resolvedCanonical && resolvedCanonical.split('#')[0] === pageUrl.split('#')[0]) points += 30;
  if (!resolvedCanonical) res.recommendations.push('Add a rel="canonical" link.');
  if (!resolvedOg) res.recommendations.push('Add og:url for clarity.');
  res.score = points;
  return res;
}

// -------------------------------------
// Crawlability Analysis
// -------------------------------------
function analyzeCrawlability($, pageUrl) {
  const res = { score: 0, maxScore: 100, issues: [], recommendations: [], details: {} };
  const robotsMeta = $('meta[name="robots"]').attr('content') || '';
  const isNoIndex = /noindex/i.test(robotsMeta);
  const isNoFollow = /nofollow/i.test(robotsMeta);

  const anchors = $('a[href]').map((i, a) => $(a).attr('href')).get();
  const internal = anchors.filter(h => h && !/^https?:\/\//i.test(h)).length;
  const nofollowLinks = $('a[rel*="nofollow"]').length;

  res.details = { robotsMeta, internalLinks: internal, nofollowLinks };

  let points = 50; // start from decent
  if (isNoIndex) { res.issues.push('Page is noindex.'); points -= 40; }
  if (isNoFollow) { res.recommendations.push('Avoid nofollow on important pages.'); points -= 10; }
  if (internal === 0) res.recommendations.push('Add internal links to important pages.');

  res.score = Math.max(0, points);
  return res;
}

module.exports = {
  analyzeFaqHowToSchema,
  analyzeBreadcrumbs,
  analyzeContentStructure,
  analyzePerformance,
  analyzeMetaConsistency,
  analyzeCanonicalOgAlignment,
  analyzeCrawlability
};
