// server.js
// Schema / SEO / AEO / GEO Analyzer (full, hardened)
// ---------------------------------------------------

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const universalExtractor = require('./universalSchemaExtractor');

// AI-readiness modules
const { analyzeLlmQueryAnswerability } = require('./modules/llmQueryAnswerability');
const { analyzeEntityClarity } = require('./modules/entityClarity');
const { analyzeLocalRelevanceSignals } = require('./modules/localRelevanceSignals');
const { analyzeRoomSchemaCompleteness } = require('./modules/roomSchemaCompleteness');
const { analyzeImageAiReadiness } = require('./modules/imageAiReadiness');
const { analyzePolicyCompleteness } = require('./modules/policyCompleteness');
const { detectContentContradictions } = require('./modules/contentContradictionDetector');
const { analyzeJsContentWarnings } = require('./modules/jsContentWarnings');
const { detectAiReadySummaries } = require('./modules/summaryDetector');
const { suggestMissingSchemas } = require('./modules/schemaSuggestions');
const { validateAiMetadata } = require('./modules/aiMetadataValidator');
const { analyzeInternalLinkingDepth } = require('./modules/internalLinkingDepth');
const { analyzeContentStaleness } = require('./modules/contentStaleness');

// Utilities
const TARGET_SCHEMAS = require('./constants/schemas');
const { safeStr, cleanJsonLikeString } = require('./utils/stringUtils');
const { isValidUrl, isAbsolute, absolutize } = require('./utils/urlUtils');
const { isValidDate, isValidTime } = require('./utils/dateUtils');
const { textFrom } = require('./utils/cheerioUtils');
const { countSyllables, countWords, countSentences, fleschKincaidReadingEase } = require('./utils/readabilityUtils');
const { normalizeType, normalizeSchemaObject, matchesTargetSchemas } = require('./utils/schemaUtils');

// Services
const { richResultsEligibility } = require('./services/richResults');
const { extractJsonLd, extractMicrodata, extractRdfa } = require('./services/schemaExtractor');
const { analyzeRobotsTxt, analyzeLlmTxt, analyzeAiTxt, analyzeOpenGraph, analyzeSitemap } = require('./services/seoAnalysis');
const { analyzeFaqHowToSchema, analyzeBreadcrumbs, analyzeContentStructure, analyzePerformance, analyzeMetaConsistency, analyzeCanonicalOgAlignment, analyzeCrawlability } = require('./services/contentAnalysis');
const { validateSchema, detectNonStandardProperties, analyzeHtmlContent, checkDateFreshness } = require('./services/schemaValidator');
const { renderPageWithJavaScript } = require('./services/htmlFetcher');

// -------------------------------------
// App setup
// -------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' :
          (process.env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim()),
  optionsSuccessStatus: 200
};

// Trust proxy for Vercel deployment (fixes X-Forwarded-For warnings)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', limiter);
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------
// API Route
// -------------------------------------
// Diagnostic endpoint to check environment variables
app.get('/api/debug-env', (req, res) => {
  res.json({
    ENABLE_JS_RENDERING: process.env.ENABLE_JS_RENDERING,
    type: typeof process.env.ENABLE_JS_RENDERING,
    length: process.env.ENABLE_JS_RENDERING?.length,
    isTrue: process.env.ENABLE_JS_RENDERING === 'true',
    allEnableFlags: Object.keys(process.env).filter(k => k.includes('ENABLE'))
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    let pageUrl;
    try { pageUrl = new URL(url).href; } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

    // Try JavaScript rendering first if enabled
    let html = null;
    let finalUrl = pageUrl;
    let renderMethod = 'axios';
    let universallyExtractedSchemas = [];  // Schemas extracted by universal extractor

    const jsRenderResult = await renderPageWithJavaScript(pageUrl);
    if (jsRenderResult && jsRenderResult.success) {
      html = jsRenderResult.html;
      finalUrl = pageUrl; // Puppeteer handles redirects internally
      renderMethod = 'puppeteer';
      // Use schemas extracted by universal extractor from Puppeteer
      if (jsRenderResult.extractedSchemas && jsRenderResult.extractedSchemas.length > 0) {
        universallyExtractedSchemas = jsRenderResult.extractedSchemas;
        console.log('[Analyze] Using universally extracted schemas from Puppeteer:', universallyExtractedSchemas.length);
      }
    } else {
      // Fallback to axios with enhanced bot bypass
      const timeout = parseInt(process.env.TIMEOUT_PAGE || '15000');
      const maxContentLength = parseInt(process.env.MAX_CONTENT_LENGTH || '10485760');

      // Enhanced headers for bot bypass (if enabled)
      const enhancedBypass = process.env.ENABLE_ENHANCED_BOT_BYPASS === 'true';
      const headers = enhancedBypass ? {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-site': 'none',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-user': '?1',
        'sec-fetch-dest': 'document',
        'upgrade-insecure-requests': '1',
        'dnt': '1',
        'cache-control': 'max-age=0'
      } : {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.8'
      };

      const response = await axios.get(pageUrl, {
        timeout,
        maxContentLength,
        maxBodyLength: maxContentLength,
        headers,
        maxRedirects: 5
      });
      finalUrl = response.request?.res?.responseUrl || pageUrl;
      html = response.data;
      renderMethod = 'axios';
    }

    if (!html || typeof html !== 'string') return res.status(400).json({ error: 'Invalid HTML content.' });

    let $;
    try { $ = cheerio.load(html); } catch { return res.status(400).json({ error: 'Unable to parse HTML.' }); }

    // Extract schemas using multiple methods
    let jsonLd = [];

    // Priority 1: Use universally extracted schemas from Puppeteer (most reliable)
    if (universallyExtractedSchemas.length > 0) {
      jsonLd = universallyExtractedSchemas;
      console.log('[Analyze] Using universal extraction results');
    }

    // Priority 2: If no Puppeteer schemas, use universal extraction on HTML
    if (jsonLd.length === 0) {
      const universalResults = universalExtractor.extractFromCheerioHtml(html);
      const normalized = universalExtractor.normalizeSchemaResults(universalResults);
      if (normalized.length > 0) {
        jsonLd = normalized;
        console.log('[Analyze] Using universal extraction from HTML:', jsonLd.length);
      }
    }

    // Priority 3: Fallback to traditional extraction
    if (jsonLd.length === 0) {
      jsonLd = extractJsonLd($);
      console.log('[Analyze] Using traditional JSON-LD extraction:', jsonLd.length);
    }

    // Always extract microdata and RDFa as supplementary data
    const microdata = extractMicrodata($, finalUrl);
    const rdfa = extractRdfa($, finalUrl);

    // Merge all schemas for cross-analyses
    const allSchemas = [...jsonLd, ...microdata, ...rdfa];
    console.log('[Analyze] Total schemas (JSON-LD + Microdata + RDFa):', allSchemas.length);

    // Analyses
    const robotsAnalysis = await analyzeRobotsTxt(finalUrl);
    const llmAnalysis = await analyzeLlmTxt(finalUrl);
    const aiAnalysis = await analyzeAiTxt(finalUrl);
    const openGraphAnalysis = await analyzeOpenGraph(finalUrl);
    const sitemapAnalysis = await analyzeSitemap(finalUrl);
    const faqHowToAnalysis = analyzeFaqHowToSchema(allSchemas);
    const breadcrumbAnalysis = analyzeBreadcrumbs($, finalUrl);
    const contentStructureAnalysis = analyzeContentStructure($);
    const performanceAnalysis = analyzePerformance($, html, finalUrl);
    const metaConsistency = analyzeMetaConsistency($, allSchemas);
    const canonicalOgAlignment = analyzeCanonicalOgAlignment($, finalUrl);
    const crawlability = analyzeCrawlability($, finalUrl);
    const richEligibility = richResultsEligibility(allSchemas, finalUrl);

    // Validation for target schemas
    const matched = [];
    allSchemas.forEach((schema, index) => {
      const schemaType = normalizeType(schema['@type']);
      if (schemaType && matchesTargetSchemas(schemaType)) {
        const primaryType = schemaType.split(',')[0].trim(); // if multiple, pick first for rules
        const validation = validateSchema(schema, primaryType);

        // Detect non-standard properties
        const nonStandardWarnings = detectNonStandardProperties(schema, primaryType);
        if (nonStandardWarnings.length > 0) {
          validation.nonStandardProperties = nonStandardWarnings;
          validation.recommendations.push({
            message: `Found ${nonStandardWarnings.length} non-standard property/properties. These may not be recognized by search engines.`,
            type: 'non-standard-summary',
            details: nonStandardWarnings
          });
        }

        // Analyze HTML content in text fields
        const htmlContentWarnings = analyzeHtmlContent(schema, primaryType);
        if (htmlContentWarnings.length > 0) {
          validation.htmlContentWarnings = htmlContentWarnings;
          validation.recommendations.push({
            message: `Found HTML tags in ${htmlContentWarnings.length} text field(s). Consider using plain text for better compatibility.`,
            type: 'html-content-summary',
            details: htmlContentWarnings
          });
        }

        // Check date freshness
        const dateFreshnessWarnings = checkDateFreshness(schema);
        if (dateFreshnessWarnings.length > 0) {
          validation.dateFreshnessWarnings = dateFreshnessWarnings;
          const oldDates = dateFreshnessWarnings.filter(w => w.severity === 'warning').length;
          if (oldDates > 0) {
            validation.recommendations.push({
              message: `Found ${oldDates} date(s) over 2 years old. Update content dates for better freshness signals.`,
              type: 'date-freshness-summary',
              details: dateFreshnessWarnings
            });
          }
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

    // Overall validation score
    const totalValidationScore = matched.reduce((s, m) => s + (m.validation?.score || 0), 0);
    const totalMaxScore = matched.reduce((s, m) => s + (m.validation?.maxScore || 0), 0);
    const schemaCount = matched.length;
    const averageValidationScore = schemaCount ? Math.round(totalValidationScore / schemaCount) : 0;

    // AI-readiness analysis
    console.log('[Analyze] Running AI-readiness modules...');
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
    const internalLinking = analyzeInternalLinkingDepth(html, pageUrl);
    const contentStaleness = analyzeContentStaleness(html, allSchemas);
    console.log('[Analyze] AI-readiness modules completed');

    return res.json({
      url: finalUrl,
      renderMethod, // 'puppeteer' or 'axios'
      jsonLd,
      microdata,
      rdfa,
      allSchemasCount: allSchemas.length,
      matched,
      validation: {
        averageScore: averageValidationScore,
        totalScore: totalValidationScore,
        totalMaxScore: totalMaxScore,
        schemaCount
      },
      // SEO/AEO/GEO & infra
      robotsAnalysis,
      llmAnalysis,
      aiAnalysis,
      openGraphAnalysis,
      sitemapAnalysis,
      faqHowToAnalysis,
      breadcrumbAnalysis,
      contentStructureAnalysis,
      performanceAnalysis,
      metaConsistency,
      canonicalOgAlignment,
      crawlability,
      richEligibility,
      // AI-readiness analysis
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
    });
  } catch (error) {
    console.error('API Analysis error:', error);

    // Sanitize error messages for production
    let userMessage = 'An error occurred while analyzing the URL.';

    if (error.code === 'ENOTFOUND') {
      userMessage = 'Unable to reach the URL. Please check the domain name.';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      userMessage = 'Request timed out. The website may be slow or unreachable.';
    } else if (error.response?.status === 403) {
      userMessage = 'Access forbidden. The website may be blocking automated requests.';
    } else if (error.response?.status === 404) {
      userMessage = 'Page not found. Please check the URL.';
    } else if (error.response?.status === 429) {
      userMessage = 'Too many requests to the target site. Please try again later.';
    } else if (error.response?.status >= 500) {
      userMessage = 'The target website is experiencing server errors.';
    } else if (NODE_ENV === 'development') {
      userMessage = `Development error: ${error.message}`;
    }

    return res.status(500).json({ error: userMessage });
  }
});

// -------------------------------------
// Serve UI
// -------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// For local run:
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

// Export for serverless, tests, etc.
module.exports = app;
