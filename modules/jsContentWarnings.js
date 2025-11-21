// modules/jsContentWarnings.js
// Warns about content that only appears via JavaScript

/**
 * Detect content that's JS-dependent vs static
 * Compares axios HTML vs Puppeteer HTML
 */
function analyzeJsContentWarnings(axiosHtml, puppeteerHtml, renderMethod) {
  const analysis = {
    score: 100, // Start perfect, deduct for JS-dependency
    isJsDependent: false,
    jsRenderedContentPercent: 0,
    staticContentSize: 0,
    dynamicContentSize: 0,
    contentDifference: 0,
    criticalContentOnlyInJs: [],
    warnings: [],
    recommendations: []
  };

  // If no JS rendering happened, can't analyze
  if (renderMethod !== 'puppeteer' || !puppeteerHtml) {
    analysis.warnings.push('JavaScript rendering not available - cannot detect JS-only content');
    return analysis;
  }

  // Calculate content sizes
  analysis.staticContentSize = axiosHtml ? axiosHtml.length : 0;
  analysis.dynamicContentSize = puppeteerHtml.length;
  analysis.contentDifference = analysis.dynamicContentSize - analysis.staticContentSize;

  // Calculate how much content is JS-rendered
  if (analysis.staticContentSize > 0) {
    analysis.jsRenderedContentPercent = Math.round(
      (analysis.contentDifference / analysis.dynamicContentSize) * 100
    );
  }

  // Check if site is heavily JS-dependent
  if (analysis.jsRenderedContentPercent > 30) {
    analysis.isJsDependent = true;
    analysis.score -= 30;

    analysis.warnings.push({
      type: 'heavy-js-dependency',
      severity: 'high',
      message: `${analysis.jsRenderedContentPercent}% of content only available via JavaScript`,
      detail: 'AI crawlers may not execute JavaScript - content might be invisible'
    });

    analysis.recommendations.push(
      'Implement server-side rendering (SSR) for critical content'
    );
  } else if (analysis.jsRenderedContentPercent > 15) {
    analysis.score -= 15;

    analysis.warnings.push({
      type: 'moderate-js-dependency',
      severity: 'medium',
      message: `${analysis.jsRenderedContentPercent}% of content requires JavaScript`,
      detail: 'Some AI systems may miss this content'
    });

    analysis.recommendations.push(
      'Consider reducing JavaScript-only content or ensure AI crawlers can render JS'
    );
  }

  // Check for critical content only in JS-rendered version
  const staticHtmlLower = axiosHtml ? axiosHtml.toLowerCase() : '';
  const dynamicHtmlLower = puppeteerHtml.toLowerCase();

  const criticalPatterns = {
    price: /\$\s*\d+|\d+\s*(?:usd|eur|gbp)|price|cost|rate/i,
    contact: /telephone|phone|email|contact/i,
    booking: /book now|reserve|reservation|availability/i,
    address: /address|location|directions/i,
    rating: /rating|review|stars/i
  };

  Object.entries(criticalPatterns).forEach(([key, pattern]) => {
    const inStatic = pattern.test(staticHtmlLower);
    const inDynamic = pattern.test(dynamicHtmlLower);

    if (!inStatic && inDynamic) {
      analysis.criticalContentOnlyInJs.push(key);
      analysis.score -= 10;

      analysis.warnings.push({
        type: 'critical-content-js-only',
        severity: 'high',
        message: `${key} information only available via JavaScript`,
        detail: 'This critical content may be invisible to some AI systems'
      });
    }
  });

  if (analysis.criticalContentOnlyInJs.length > 0) {
    analysis.recommendations.push(
      `Make ${analysis.criticalContentOnlyInJs.join(', ')} visible in static HTML`
    );
  }

  // Check if schema is JS-injected
  const staticSchemaCount = (staticHtmlLower.match(/<script[^>]*type=["']application\/ld\+json["']/g) || []).length;
  const dynamicSchemaCount = (dynamicHtmlLower.match(/<script[^>]*type=["']application\/ld\+json["']/g) || []).length;

  if (dynamicSchemaCount > staticSchemaCount) {
    analysis.score -= 15;

    analysis.warnings.push({
      type: 'schema-js-injected',
      severity: 'high',
      message: `${dynamicSchemaCount - staticSchemaCount} schema blocks only appear after JavaScript execution`,
      detail: 'Schema may be invisible to crawlers that don\'t execute JS'
    });

    analysis.recommendations.push(
      'Inject schema server-side instead of client-side JavaScript'
    );
  }

  // Ensure score doesn't go below 0
  analysis.score = Math.max(0, analysis.score);

  console.log('[JS Content] JS-rendered content:', analysis.jsRenderedContentPercent + '%');
  console.log('[JS Content] Critical content only in JS:', analysis.criticalContentOnlyInJs.length);
  console.log('[JS Content] Score:', analysis.score);

  return analysis;
}

module.exports = { analyzeJsContentWarnings };
