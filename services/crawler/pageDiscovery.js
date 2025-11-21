// services/crawler/pageDiscovery.js
// Discover important pages from sitemap or homepage links

const axios = require('axios');
const cheerio = require('cheerio');
const { isSameDomain, getBaseUrl, deduplicateUrls } = require('../../utils/urlNormalizer');
const { VisitedTracker } = require('../../utils/circularLinkProtection');

/**
 * Discover pages from sitemap.xml
 */
async function discoverFromSitemap(baseUrl, maxPages = 10) {
  try {
    const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
    console.log(`[Page Discovery] Fetching sitemap: ${sitemapUrl}`);

    const response = await axios.get(sitemapUrl, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      maxContentLength: 10485760
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const urls = [];

    // Parse sitemap URLs
    $('url loc').each((i, el) => {
      if (urls.length < maxPages) {
        const url = $(el).text().trim();
        if (url && isSameDomain(url, baseUrl)) {
          urls.push(url);
        }
      }
    });

    console.log(`[Page Discovery] Found ${urls.length} URLs in sitemap`);
    return urls;
  } catch (error) {
    console.log(`[Page Discovery] Sitemap not available or error: ${error.message}`);
    return [];
  }
}

/**
 * Discover pages from homepage links
 */
async function discoverFromHomepage(baseUrl, maxPages = 10) {
  try {
    console.log(`[Page Discovery] Fetching homepage: ${baseUrl}`);

    const response = await axios.get(baseUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      maxContentLength: 10485760
    });

    const $ = cheerio.load(response.data);
    const urls = new Set();

    // Find all internal links
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const absoluteUrl = new URL(href, baseUrl).href;
        if (isSameDomain(absoluteUrl, baseUrl)) {
          urls.add(absoluteUrl);
        }
      } catch {}
    });

    const discovered = Array.from(urls).slice(0, maxPages);
    console.log(`[Page Discovery] Found ${discovered.length} URLs from homepage`);
    return discovered;
  } catch (error) {
    console.log(`[Page Discovery] Homepage crawl error: ${error.message}`);
    return [];
  }
}

/**
 * Discover and classify important pages for a site
 */
async function discoverPages(baseUrl, maxPages = 10) {
  // Always include the base URL (homepage)
  const urls = [baseUrl];

  // Try sitemap first
  const sitemapUrls = await discoverFromSitemap(baseUrl, maxPages - 1);
  urls.push(...sitemapUrls);

  // If sitemap didn't provide enough, try homepage links
  if (urls.length < maxPages) {
    const homepageUrls = await discoverFromHomepage(baseUrl, maxPages - urls.length);
    urls.push(...homepageUrls);
  }

  // Deduplicate and limit
  const unique = deduplicateUrls(urls).slice(0, maxPages);

  // Classify each URL
  const classified = unique.map(url => classifyPage(url));

  console.log(`[Page Discovery] Discovered ${classified.length} pages`);
  return classified;
}

/**
 * Classify page type and assign weight for scoring
 */
function classifyPage(url) {
  const urlLower = url.toLowerCase();
  const path = urlLower.split('?')[0]; // Remove query params

  let pageType = 'other';
  let weight = 0.1; // Default weight for other pages

  // Homepage detection
  if (path === getBaseUrl(url) + '/' || path === getBaseUrl(url)) {
    pageType = 'homepage';
    weight = 0.30; // 30% weight for homepage
  }
  // FAQ page
  else if (/faq|frequently-asked|questions/i.test(path)) {
    pageType = 'faq';
    weight = 0.20;
  }
  // Rooms/Accommodations page
  else if (/room|suite|accommodations|lodging/i.test(path)) {
    pageType = 'rooms';
    weight = 0.20;
  }
  // Booking/Reservations page
  else if (/book|reservation|reserve|availability/i.test(path)) {
    pageType = 'booking';
    weight = 0.15;
  }
  // About page
  else if (/about|our-story|who-we-are/i.test(path)) {
    pageType = 'about';
    weight = 0.10;
  }
  // Contact page
  else if (/contact|get-in-touch|reach-us/i.test(path)) {
    pageType = 'contact';
    weight = 0.10;
  }
  // Services/Amenities page
  else if (/service|amenities|facilities|features/i.test(path)) {
    pageType = 'services';
    weight = 0.15;
  }
  // Location page
  else if (/location|directions|map|find-us/i.test(path)) {
    pageType = 'location';
    weight = 0.10;
  }

  return {
    url,
    pageType,
    weight
  };
}

module.exports = {
  discoverPages,
  discoverFromSitemap,
  discoverFromHomepage,
  classifyPage
};
