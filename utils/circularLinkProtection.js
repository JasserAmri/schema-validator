// utils/circularLinkProtection.js
// Prevent infinite crawl loops and track visited pages

const { normalizeUrl } = require('./urlNormalizer');

/**
 * Tracks visited URLs to prevent circular crawling
 */
class VisitedTracker {
  constructor() {
    this.visited = new Set();
  }

  /**
   * Check if a URL has already been visited
   */
  hasVisited(url) {
    const normalized = normalizeUrl(url, true); // Remove query params for comparison
    return this.visited.has(normalized);
  }

  /**
   * Mark a URL as visited
   */
  markVisited(url) {
    const normalized = normalizeUrl(url, true);
    this.visited.add(normalized);
  }

  /**
   * Get count of visited URLs
   */
  getVisitedCount() {
    return this.visited.size;
  }

  /**
   * Get all visited URLs
   */
  getVisited() {
    return Array.from(this.visited);
  }

  /**
   * Clear all visited URLs
   */
  clear() {
    this.visited.clear();
  }
}

module.exports = { VisitedTracker };
