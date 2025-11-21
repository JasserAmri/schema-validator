// routes/analyzeSite.js
// POST /api/analyze-site route handler
// Multi-page site analysis endpoint - ADDITIVE, does NOT modify existing /api/analyze

const express = require('express');
const { analyzeSite } = require('../services/crawler/siteAnalyzer');
const { discoverPages, classifyPage } = require('../services/crawler/pageDiscovery');
const { deduplicateUrls } = require('../utils/urlNormalizer');

const router = express.Router();

router.post('/analyze-site', async (req, res) => {
  try {
    const { url, urls, maxPages = 10, autoDiscover = true } = req.body;

    // Validate input
    if (!url && (!urls || urls.length === 0)) {
      return res.status(400).json({
        error: 'Either "url" (base URL) or "urls" (array of URLs) is required'
      });
    }

    let classifiedPages = [];

    // If URLs provided explicitly
    if (urls && urls.length > 0) {
      console.log(`[Analyze Site] Using provided URLs: ${urls.length}`);
      const uniqueUrls = deduplicateUrls(urls);
      classifiedPages = uniqueUrls.slice(0, maxPages).map(url => classifyPage(url));
    }
    // If base URL provided with auto-discovery
    else if (url && autoDiscover) {
      console.log(`[Analyze Site] Auto-discovering pages from: ${url}`);
      classifiedPages = await discoverPages(url, maxPages);
    }
    // If only base URL provided without auto-discovery
    else if (url) {
      console.log(`[Analyze Site] Analyzing single URL without discovery: ${url}`);
      classifiedPages = [classifyPage(url)];
    }

    if (classifiedPages.length === 0) {
      return res.status(400).json({
        error: 'No pages to analyze'
      });
    }

    console.log(`[Analyze Site] Starting analysis of ${classifiedPages.length} pages`);
    console.log('[Analyze Site] Page types:', classifiedPages.map(p => `${p.pageType} (${p.url})`).join(', '));

    // Run multi-page analysis
    const result = await analyzeSite(classifiedPages);

    // Add request metadata
    result.requestedUrl = url || urls[0];
    result.autoDiscovery = autoDiscover;
    result.timestamp = new Date().toISOString();

    console.log(`[Analyze Site] Analysis complete. Overall score: ${result.aggregatedScores.overall}`);
    console.log(`[Analyze Site] Cross-page issues: ${result.crossPageIssues.length}`);

    return res.json(result);

  } catch (error) {
    console.error('[Analyze Site] Error:', error);

    // User-friendly error messages
    let userMessage = 'An error occurred during site analysis.';

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
    }

    return res.status(500).json({
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
