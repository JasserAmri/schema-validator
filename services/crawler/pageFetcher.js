// services/crawler/pageFetcher.js
// Multi-page fetcher with rate limiting - SAFE WRAPPER for existing htmlFetcher

const { renderPageWithJavaScript } = require('../htmlFetcher');

/**
 * Fetch multiple pages with rate limiting to avoid overwhelming servers
 * SAFE WRAPPER - Reuses existing htmlFetcher.js without modification
 */
async function fetchPages(urls, options = {}) {
  const {
    delayBetweenRequests = 1000, // 1 second between requests
    maxConcurrent = 2, // Max 2 concurrent requests
    timeout = 30000 // 30 seconds per page
  } = options;

  const results = [];
  const queue = [...urls];

  // Process pages in batches to respect rate limits
  while (queue.length > 0) {
    const batch = queue.splice(0, maxConcurrent);

    const batchPromises = batch.map(async (url) => {
      console.log(`[Page Fetcher] Fetching: ${url}`);

      try {
        // Reuse existing htmlFetcher service
        const result = await renderPageWithJavaScript(url);

        if (result && result.success) {
          return {
            url,
            html: result.html,
            renderMethod: result.method || 'puppeteer',
            extractedSchemas: result.extractedSchemas || [],
            javascriptErrors: result.javascriptErrors || [],
            success: true
          };
        } else {
          // Fallback failed, return error state
          return {
            url,
            html: null,
            renderMethod: 'failed',
            extractedSchemas: [],
            javascriptErrors: [],
            success: false,
            error: 'Failed to render page'
          };
        }
      } catch (error) {
        console.error(`[Page Fetcher] Error fetching ${url}:`, error.message);
        return {
          url,
          html: null,
          renderMethod: 'failed',
          extractedSchemas: [],
          javascriptErrors: [],
          success: false,
          error: error.message
        };
      }
    });

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Rate limiting delay between batches
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }
  }

  console.log(`[Page Fetcher] Completed fetching ${results.length} pages`);
  console.log(`[Page Fetcher] Success: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}`);

  return results;
}

/**
 * Fetch a single page (simpler interface)
 */
async function fetchPage(url) {
  const results = await fetchPages([url]);
  return results[0];
}

module.exports = {
  fetchPages,
  fetchPage
};
