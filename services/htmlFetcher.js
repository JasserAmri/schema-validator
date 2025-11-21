// services/htmlFetcher.js
// JavaScript Rendering Service (Puppeteer with Chromium)
// --------------------------------------------------------

const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const axios = require('axios');
const cheerio = require('cheerio');
const universalExtractor = require('../universalSchemaExtractor');

// -------------------------------------
// JavaScript Rendering (Puppeteer)
// -------------------------------------
async function renderPageWithJavaScript(url) {
  console.log('[JS Render] ENABLE_JS_RENDERING =', process.env.ENABLE_JS_RENDERING);

  if (process.env.ENABLE_JS_RENDERING !== 'true') {
    console.log('[JS Render] JavaScript rendering disabled');
    return null;
  }

  console.log('[JS Render] Starting JavaScript rendering for:', url);
  let browser = null;
  try {
    // Use @sparticuz/chromium for Vercel serverless compatibility
    const execPath = await chromium.executablePath();
    console.log('[JS Render] Chromium executable path:', execPath);

    const launchOptions = {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: execPath,
      headless: chromium.headless,
    };

    console.log('[JS Render] Launching browser with args:', launchOptions.args.slice(0, 5));
    browser = await puppeteer.launch(launchOptions);
    console.log('[JS Render] Browser launched successfully');
    const page = await browser.newPage();

    // Capture console errors from the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('[JS Render] Page Console Error:', msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      console.log('[JS Render] Page JavaScript Error:', error.message);
    });

    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set extra headers for bot bypass
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    });

    // Navigate and wait for network to be idle
    const timeout = parseInt(process.env.TIMEOUT_JS_RENDER || '30000');
    console.log('[JS Render] Navigating to URL with timeout:', timeout);

    await page.goto(url, {
      waitUntil: ['load', 'networkidle0'],
      timeout: timeout
    });
    console.log('[JS Render] Page loaded, waiting for dynamic content...');

    // Log page title to confirm we're on the right page
    const pageTitle = await page.title();
    console.log('[JS Render] Page title:', pageTitle);

    // Try to wait for schema tags to appear (with timeout)
    try {
      await page.waitForSelector('script[type="application/ld+json"]', { timeout: 5000 });
      console.log('[JS Render] Found schema script tags');
    } catch (e) {
      console.log('[JS Render] No schema script tags found after 5s, continuing anyway...');
    }

    // Wait longer for dynamic content (5 seconds for slower pages)
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('[JS Render] Dynamic content wait complete');

    // Count schema tags before extraction
    const schemaCount = await page.evaluate(() => {
      return document.querySelectorAll('script[type="application/ld+json"]').length;
    });
    console.log('[JS Render] Schema script tags in page:', schemaCount);

    // Extract final HTML with all JavaScript-generated content
    const html = await page.content();
    console.log('[JS Render] Successfully extracted HTML, length:', html.length);

    // Check if HTML actually contains schemas
    const hasJsonLd = html.includes('application/ld+json');
    const hasSchema = html.includes('schema.org');
    console.log('[JS Render] HTML contains JSON-LD:', hasJsonLd, 'Schema.org references:', hasSchema);

    // **UNIVERSAL SCHEMA EXTRACTION** - Extract all schemas using advanced methods
    console.log('[JS Render] Starting universal schema extraction...');
    const extractedSchemas = await universalExtractor.extractFromPuppeteerPage(page);
    const normalizedSchemas = universalExtractor.normalizeSchemaResults(extractedSchemas);
    console.log('[JS Render] Universal extraction complete. Found schemas:', normalizedSchemas.length);

    await browser.close();
    console.log('[JS Render] Browser closed, rendering complete');

    return {
      html,
      success: true,
      method: 'puppeteer',
      extractedSchemas: normalizedSchemas  // Add extracted schemas to response
    };

  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }

    console.error('[JS Render] ERROR:', error.message);
    console.error('[JS Render] ERROR Stack:', error.stack);

    return {
      html: null,
      success: false,
      method: 'puppeteer',
      error: error.message
    };
  }
}

module.exports = {
  renderPageWithJavaScript
};
