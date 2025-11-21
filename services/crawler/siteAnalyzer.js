// services/crawler/siteAnalyzer.js
// Multi-page site analysis orchestrator - SAFE WRAPPER that reuses all existing analyzers

const cheerio = require('cheerio');
const { fetchPages } = require('./pageFetcher');
const { getBaseUrl } = require('../../utils/urlNormalizer');
const { safeString } = require('../../utils/safeString');

// Reuse existing services (NO MODIFICATIONS)
const { extractJsonLd, extractMicrodata, extractRdfa } = require('../schemaExtractor');
const { validateSchema, detectNonStandardProperties, analyzeHtmlContent, checkDateFreshness } = require('../schemaValidator');
const { analyzeRobotsTxt, analyzeLlmTxt, analyzeAiTxt, analyzeOpenGraph, analyzeSitemap } = require('../seoAnalysis');
const { analyzeFaqHowToSchema, analyzeBreadcrumbs, analyzeContentStructure, analyzePerformance, analyzeMetaConsistency, analyzeCanonicalOgAlignment, analyzeCrawlability } = require('../contentAnalysis');
const { richResultsEligibility } = require('../richResults');
const universalExtractor = require('../../universalSchemaExtractor');

// Reuse existing AI-readiness modules (NO MODIFICATIONS)
const { analyzeLlmQueryAnswerability } = require('../../modules/llmQueryAnswerability');
const { analyzeEntityClarity } = require('../../modules/entityClarity');
const { analyzeLocalRelevanceSignals } = require('../../modules/localRelevanceSignals');
const { analyzeRoomSchemaCompleteness } = require('../../modules/roomSchemaCompleteness');
const { analyzeImageAiReadiness } = require('../../modules/imageAiReadiness');
const { analyzePolicyCompleteness } = require('../../modules/policyCompleteness');
const { detectContentContradictions } = require('../../modules/contentContradictionDetector');
const { analyzeJsContentWarnings } = require('../../modules/jsContentWarnings');
const { detectAiReadySummaries } = require('../../modules/summaryDetector');
const { suggestMissingSchemas } = require('../../modules/schemaSuggestions');
const { validateAiMetadata } = require('../../modules/aiMetadataValidator');
const { analyzeInternalLinkingDepth } = require('../../modules/internalLinkingDepth');
const { analyzeContentStaleness } = require('../../modules/contentStaleness');
const { normalizeType, matchesTargetSchemas } = require('../../utils/schemaUtils');

/**
 * Analyze a single page using ALL existing analyzers
 * SAFE WRAPPER - Reuses exact logic from routes/analyze.js
 */
async function analyzePageInternal(url, html, renderMethod, extractedSchemas = []) {
  try {
    const $ = cheerio.load(html);

    // Schema extraction (reuse existing extractors)
    const jsonLd = extractJsonLd($);
    const microdata = extractMicrodata($, url);
    const rdfa = extractRdfa($, url);

    // Combine with universally extracted schemas
    let allSchemas = [...jsonLd, ...microdata, ...rdfa];
    if (extractedSchemas && extractedSchemas.length > 0) {
      console.log(`[Site Analyzer] Using ${extractedSchemas.length} universally extracted schemas for ${url}`);
      allSchemas = [...allSchemas, ...extractedSchemas];
    }

    // Schema validation
    const matched = [];
    allSchemas.forEach((schema, index) => {
      const schemaType = normalizeType(schema['@type']);
      if (matchesTargetSchemas(schemaType)) {
        const validation = validateSchema(schema, schemaType);

        // Enhancements
        if (process.env.ENABLE_NON_STANDARD_WARNINGS === 'true') {
          validation.nonStandardWarnings = detectNonStandardProperties(schema, schemaType);
        }
        if (process.env.ENABLE_HTML_CONTENT_ANALYSIS === 'true') {
          validation.htmlContentWarnings = analyzeHtmlContent(schema, schemaType);
        }
        if (process.env.ENABLE_DATE_FRESHNESS_CHECK === 'true') {
          validation.dateFreshnessWarnings = checkDateFreshness(schema);
        }

        matched.push({
          type: schemaType,
          sourceIndex: index,
          source: jsonLd.includes(schema) ? 'JSON-LD' : (microdata.includes(schema) ? 'Microdata' : 'RDFa'),
          data: schema,
          validation
        });
      }
    });

    // Validation scores
    const totalValidationScore = matched.reduce((s, m) => s + (m.validation?.score || 0), 0);
    const totalMaxScore = matched.reduce((s, m) => s + (m.validation?.maxScore || 0), 0);
    const schemaCount = matched.length;
    const averageValidationScore = schemaCount ? Math.round(totalValidationScore / schemaCount) : 0;

    // Content analysis (reuse existing analyzers)
    const faqHowToAnalysis = analyzeFaqHowToSchema(allSchemas);
    const breadcrumbAnalysis = analyzeBreadcrumbs($, url);
    const contentStructureAnalysis = analyzeContentStructure($);
    const performanceAnalysis = analyzePerformance($, html, url);
    const metaConsistency = analyzeMetaConsistency($, matched);
    const canonicalOgAlignment = analyzeCanonicalOgAlignment($, url);
    const crawlability = analyzeCrawlability($, url);
    const richEligibility = richResultsEligibility(allSchemas, url);

    // AI-readiness analysis (reuse all 13 modules)
    const llmQueryAnswerability = analyzeLlmQueryAnswerability(html, allSchemas);
    const entityClarity = analyzeEntityClarity(allSchemas);
    const localRelevanceSignals = analyzeLocalRelevanceSignals(allSchemas, html);
    const roomSchemaCompleteness = analyzeRoomSchemaCompleteness(allSchemas);
    const imageAiReadiness = analyzeImageAiReadiness(allSchemas, html);
    const policyCompleteness = analyzePolicyCompleteness(allSchemas, html);
    const contentContradictions = detectContentContradictions(allSchemas, html);
    const jsContentWarnings = analyzeJsContentWarnings(
      renderMethod === 'axios' ? html : null,
      renderMethod === 'puppeteer' ? html : null,
      renderMethod
    );
    const aiReadySummaries = detectAiReadySummaries(allSchemas, html);
    const missingSchemas = suggestMissingSchemas(allSchemas, html);
    const aiMetadata = validateAiMetadata(html);
    const internalLinking = analyzeInternalLinkingDepth(html, url);
    const contentStaleness = analyzeContentStaleness(html, allSchemas);

    return {
      url,
      renderMethod,
      jsonLd,
      microdata,
      rdfa,
      allSchemasCount: allSchemas.length,
      matched,
      validation: {
        averageScore: averageValidationScore,
        totalScore: totalValidationScore,
        totalMaxScore,
        schemaCount
      },
      faqHowToAnalysis,
      breadcrumbAnalysis,
      contentStructureAnalysis,
      performanceAnalysis,
      metaConsistency,
      canonicalOgAlignment,
      crawlability,
      richEligibility,
      aiReadiness: {
        llmQueryAnswerability,
        entityClarity,
        localRelevanceSignals,
        roomSchemaCompleteness,
        imageAiReadiness,
        policyCompleteness,
        contentContradictions,
        jsContentWarnings,
        aiReadySummaries,
        missingSchemas,
        aiMetadata,
        internalLinking,
        contentStaleness
      }
    };
  } catch (error) {
    console.error(`[Site Analyzer] Error analyzing page ${url}:`, error);
    return {
      url,
      error: error.message,
      renderMethod: 'failed'
    };
  }
}

/**
 * Detect contradictions across multiple pages
 */
function detectCrossPageContradictions(pageResults) {
  const contradictions = [];
  const businessNames = new Map();
  const addresses = new Map();
  const phones = new Map();
  const ratings = new Map();

  pageResults.forEach(page => {
    if (!page.matched) return;

    page.matched.forEach(schema => {
      const schemaType = schema.type || '';

      // Collect business names
      if (schema.data.name) {
        const name = safeString(schema.data.name);
        if (!businessNames.has(name)) {
          businessNames.set(name, []);
        }
        businessNames.get(name).push(page.url);
      }

      // Collect addresses
      if (schema.data.address) {
        const addr = schema.data.address;
        const addrStr = safeString(addr.streetAddress || '') + safeString(addr.addressLocality || '');
        if (addrStr && !addresses.has(addrStr)) {
          addresses.set(addrStr, []);
        }
        if (addrStr) addresses.get(addrStr).push(page.url);
      }

      // Collect phone numbers
      if (schema.data.telephone) {
        const phone = safeString(schema.data.telephone).replace(/\D/g, '');
        if (phone && !phones.has(phone)) {
          phones.set(phone, []);
        }
        if (phone) phones.get(phone).push(page.url);
      }

      // Collect ratings
      if (schema.data.aggregateRating) {
        const rating = schema.data.aggregateRating.ratingValue;
        if (rating && !ratings.has(rating)) {
          ratings.set(rating, []);
        }
        if (rating) ratings.get(rating).push(page.url);
      }
    });
  });

  // Detect name contradictions
  if (businessNames.size > 1) {
    contradictions.push({
      type: 'name-mismatch',
      severity: 'high',
      pages: Array.from(businessNames.values()).flat(),
      values: Array.from(businessNames.keys()),
      message: `Multiple business names found across pages: ${Array.from(businessNames.keys()).join(', ')}`
    });
  }

  // Detect address contradictions
  if (addresses.size > 1) {
    contradictions.push({
      type: 'address-mismatch',
      severity: 'medium',
      pages: Array.from(addresses.values()).flat(),
      values: Array.from(addresses.keys()),
      message: 'Different addresses found across pages'
    });
  }

  // Detect phone contradictions
  if (phones.size > 1) {
    contradictions.push({
      type: 'phone-mismatch',
      severity: 'medium',
      pages: Array.from(phones.values()).flat(),
      values: Array.from(phones.keys()),
      message: 'Different phone numbers found across pages'
    });
  }

  // Detect rating contradictions
  if (ratings.size > 1) {
    contradictions.push({
      type: 'rating-mismatch',
      severity: 'low',
      pages: Array.from(ratings.values()).flat(),
      values: Array.from(ratings.keys()),
      message: 'Different ratings found across pages'
    });
  }

  return contradictions;
}

/**
 * Compute weighted aggregate scores across all pages
 */
function computeAggregateScores(classifiedPages, pageResults) {
  let overallScore = 0;
  let schemaQuality = 0;
  let aiReadiness = 0;
  let seoFoundation = 0;
  let technical = 0;
  let contentQuality = 0;

  let totalWeight = 0;

  classifiedPages.forEach(page => {
    const result = pageResults.find(r => r.url === page.url);
    if (!result || !result.validation) return;

    const weight = page.weight || 0.1;
    totalWeight += weight;

    // Schema quality score (validation average)
    schemaQuality += (result.validation.averageScore || 0) * weight;

    // AI readiness score (average of all AI modules)
    const aiModules = result.aiReadiness || {};
    const aiScores = [
      aiModules.llmQueryAnswerability?.score || 0,
      aiModules.entityClarity?.score || 0,
      aiModules.localRelevanceSignals?.score || 0,
      aiModules.roomSchemaCompleteness?.score || 0,
      aiModules.imageAiReadiness?.score || 0,
      aiModules.policyCompleteness?.score || 0,
      aiModules.contentContradictions?.score || 0,
      aiModules.jsContentWarnings?.score || 0,
      aiModules.aiReadySummaries?.score || 0,
      aiModules.aiMetadata?.score || 0,
      aiModules.internalLinking?.score || 0,
      aiModules.contentStaleness?.score || 0
    ];
    const aiAvg = aiScores.reduce((a, b) => a + b, 0) / aiScores.length;
    aiReadiness += aiAvg * weight;

    // Technical score (performance + crawlability)
    technical += ((result.performanceAnalysis?.score || 0) + (result.crawlability?.score || 0)) / 2 * weight;

    // Content quality score
    contentQuality += ((result.contentStructureAnalysis?.readabilityScore || 0) + (result.faqHowToAnalysis?.score || 0)) / 2 * weight;
  });

  // Normalize by total weight
  if (totalWeight > 0) {
    schemaQuality = Math.round(schemaQuality / totalWeight);
    aiReadiness = Math.round(aiReadiness / totalWeight);
    technical = Math.round(technical / totalWeight);
    contentQuality = Math.round(contentQuality / totalWeight);
  }

  // Overall score (weighted average)
  overallScore = Math.round(
    schemaQuality * 0.25 +
    aiReadiness * 0.25 +
    seoFoundation * 0.20 +
    technical * 0.15 +
    contentQuality * 0.15
  );

  return {
    overall: overallScore,
    schemaQuality,
    aiReadiness,
    seoFoundation,
    technical,
    contentQuality
  };
}

/**
 * Analyze entire site across multiple pages
 */
async function analyzeSite(classifiedPages) {
  console.log(`[Site Analyzer] Starting site analysis for ${classifiedPages.length} pages`);

  // Extract base URL from first page
  const baseUrl = getBaseUrl(classifiedPages[0].url);

  // 1. Fetch all pages
  const urls = classifiedPages.map(p => p.url);
  const fetchedPages = await fetchPages(urls, {
    delayBetweenRequests: 1500,
    maxConcurrent: 2
  });

  // 2. Run site-wide analyzers ONCE (domain-level)
  console.log(`[Site Analyzer] Running site-wide analyzers for ${baseUrl}`);
  const [robotsAnalysis, llmAnalysis, aiAnalysis, sitemapAnalysis] = await Promise.all([
    analyzeRobotsTxt(baseUrl),
    analyzeLlmTxt(baseUrl),
    analyzeAiTxt(baseUrl),
    analyzeSitemap(baseUrl)
  ]);

  // 3. Analyze each page individually
  console.log(`[Site Analyzer] Analyzing ${fetchedPages.length} pages individually`);
  const pageResults = [];

  for (const fetchedPage of fetchedPages) {
    if (!fetchedPage.success) {
      pageResults.push({
        url: fetchedPage.url,
        error: fetchedPage.error || 'Failed to fetch',
        success: false
      });
      continue;
    }

    const analysis = await analyzePageInternal(
      fetchedPage.url,
      fetchedPage.html,
      fetchedPage.renderMethod,
      fetchedPage.extractedSchemas
    );

    const pageInfo = classifiedPages.find(p => p.url === fetchedPage.url);
    pageResults.push({
      url: fetchedPage.url,
      pageType: pageInfo?.pageType || 'other',
      weight: pageInfo?.weight || 0.1,
      analysis,
      success: true
    });
  }

  // 4. Detect cross-page contradictions
  console.log(`[Site Analyzer] Detecting cross-page contradictions`);
  const crossPageIssues = detectCrossPageContradictions(pageResults.filter(p => p.success));

  // 5. Compute aggregated scores
  console.log(`[Site Analyzer] Computing aggregated scores`);
  const aggregatedScores = computeAggregateScores(classifiedPages, pageResults.filter(p => p.success));

  // 6. SEO foundation score (average of site-wide analyzers)
  aggregatedScores.seoFoundation = Math.round(
    ((robotsAnalysis.score || 0) +
     (llmAnalysis.score || 0) +
     (aiAnalysis.score || 0) +
     (sitemapAnalysis.score || 0)) / 4
  );

  // Recompute overall with updated SEO score
  aggregatedScores.overall = Math.round(
    aggregatedScores.schemaQuality * 0.25 +
    aggregatedScores.aiReadiness * 0.25 +
    aggregatedScores.seoFoundation * 0.20 +
    aggregatedScores.technical * 0.15 +
    aggregatedScores.contentQuality * 0.15
  );

  console.log(`[Site Analyzer] Site analysis complete. Overall score: ${aggregatedScores.overall}`);

  return {
    siteUrl: baseUrl,
    crawledPages: pageResults,
    siteWideAnalysis: {
      robots: robotsAnalysis,
      llms: llmAnalysis,
      ai: aiAnalysis,
      sitemap: sitemapAnalysis
    },
    crossPageIssues,
    aggregatedScores,
    pageCount: pageResults.length,
    successfulPages: pageResults.filter(p => p.success).length
  };
}

module.exports = {
  analyzeSite,
  analyzePageInternal,
  detectCrossPageContradictions,
  computeAggregateScores
};
