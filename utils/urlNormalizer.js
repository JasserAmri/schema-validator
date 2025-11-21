// utils/urlNormalizer.js
// URL normalization and deduplication utilities

/**
 * Normalize a URL for consistent comparison
 * - Removes trailing slashes
 * - Removes fragments (#section)
 * - Removes query parameters (optional)
 * - Converts to lowercase (hostname only)
 */
function normalizeUrl(url, removeQuery = false) {
  try {
    const urlObj = new URL(url);

    // Normalize hostname to lowercase
    urlObj.hostname = urlObj.hostname.toLowerCase();

    // Remove trailing slash from pathname
    if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }

    // Remove fragment
    urlObj.hash = '';

    // Optionally remove query parameters
    if (removeQuery) {
      urlObj.search = '';
    }

    return urlObj.href;
  } catch (error) {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Deduplicate an array of URLs after normalization
 */
function deduplicateUrls(urls, removeQuery = false) {
  const normalized = new Map();

  urls.forEach(url => {
    const normalizedUrl = normalizeUrl(url, removeQuery);
    if (!normalized.has(normalizedUrl)) {
      normalized.set(normalizedUrl, url); // Store original URL
    }
  });

  return Array.from(normalized.values());
}

/**
 * Check if two URLs are from the same domain
 */
function isSameDomain(url1, url2) {
  try {
    const domain1 = new URL(url1).hostname;
    const domain2 = new URL(url2).hostname;
    return domain1 === domain2;
  } catch {
    return false;
  }
}

/**
 * Extract base URL (protocol + hostname)
 */
function getBaseUrl(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch {
    return null;
  }
}

module.exports = {
  normalizeUrl,
  deduplicateUrls,
  isSameDomain,
  getBaseUrl
};
