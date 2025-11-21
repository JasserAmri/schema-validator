// modules/internalLinkingDepth.js
// Analyzes internal linking for AI crawlability

/**
 * Analyze internal linking structure for AI crawlers
 */
function analyzeInternalLinkingDepth(html, pageUrl) {
  const analysis = {
    score: 0,
    maxScore: 100,
    totalLinks: 0,
    internalLinks: 0,
    externalLinks: 0,
    anchorLinks: 0,
    emptyLinks: 0,
    linksWithDescriptiveText: 0,
    internalLinkRatio: 0,
    linkDensity: 0,
    pageWordCount: 0,
    hasNavigationSchema: false,
    hasFooterLinks: false,
    hasSitemapLink: false,
    recommendations: []
  };

  // Extract domain from pageUrl
  let pageDomain = '';
  try {
    const urlObj = new URL(pageUrl);
    pageDomain = urlObj.hostname.replace('www.', '');
  } catch (e) {
    // If URL parsing fails, continue with empty domain
  }

  // Count words on page (approximation)
  const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                          .replace(/<[^>]+>/g, ' ');
  const words = textContent.trim().split(/\s+/).filter(w => w.length > 0);
  analysis.pageWordCount = words.length;

  // Extract all links
  const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, '').trim();

    analysis.totalLinks++;

    // Skip empty links
    if (!href || href === '#' || href === '') {
      analysis.emptyLinks++;
      continue;
    }

    // Check if anchor link
    if (href.startsWith('#')) {
      analysis.anchorLinks++;
      continue;
    }

    // Check if internal or external
    const isInternal = href.startsWith('/') ||
                      href.startsWith('./') ||
                      href.startsWith('../') ||
                      (pageDomain && href.includes(pageDomain));

    if (isInternal) {
      analysis.internalLinks++;
    } else if (href.startsWith('http://') || href.startsWith('https://')) {
      analysis.externalLinks++;
    } else {
      // Relative links are internal
      analysis.internalLinks++;
    }

    // Check if link text is descriptive
    if (linkText.length > 10 &&
        !linkText.toLowerCase().includes('click here') &&
        !linkText.toLowerCase().includes('read more') &&
        !linkText.toLowerCase().includes('learn more')) {
      analysis.linksWithDescriptiveText++;
    }

    // Check for sitemap link
    if (href.toLowerCase().includes('sitemap')) {
      analysis.hasSitemapLink = true;
    }
  }

  // Calculate ratios
  if (analysis.totalLinks > 0) {
    analysis.internalLinkRatio = Math.round(
      (analysis.internalLinks / analysis.totalLinks) * 100
    );
  }

  if (analysis.pageWordCount > 0) {
    analysis.linkDensity = Math.round(
      (analysis.totalLinks / analysis.pageWordCount) * 100
    );
  }

  // Check for navigation schema
  if (html.includes('BreadcrumbList') || html.includes('SiteNavigationElement')) {
    analysis.hasNavigationSchema = true;
  }

  // Check for footer links
  const footerRegex = /<footer[^>]*>[\s\S]*?<\/footer>/i;
  const footerMatch = html.match(footerRegex);
  if (footerMatch) {
    const footerLinks = (footerMatch[0].match(/<a[^>]*href=/gi) || []).length;
    if (footerLinks >= 5) {
      analysis.hasFooterLinks = true;
    }
  }

  // Scoring
  if (analysis.internalLinks >= 10) {
    analysis.score += 25;
  } else if (analysis.internalLinks >= 5) {
    analysis.score += 15;
  } else if (analysis.internalLinks >= 2) {
    analysis.score += 5;
  }

  if (analysis.internalLinkRatio >= 60) {
    analysis.score += 20;
  } else if (analysis.internalLinkRatio >= 40) {
    analysis.score += 10;
  }

  const descriptivePercent = analysis.totalLinks > 0 ?
    (analysis.linksWithDescriptiveText / analysis.totalLinks) * 100 : 0;

  if (descriptivePercent >= 70) {
    analysis.score += 20;
  } else if (descriptivePercent >= 50) {
    analysis.score += 10;
  }

  if (analysis.linkDensity >= 2 && analysis.linkDensity <= 5) {
    analysis.score += 15; // Sweet spot
  } else if (analysis.linkDensity < 2 && analysis.linkDensity > 0.5) {
    analysis.score += 10;
  }

  if (analysis.hasNavigationSchema) {
    analysis.score += 10;
  }

  if (analysis.hasFooterLinks) {
    analysis.score += 5;
  }

  if (analysis.hasSitemapLink) {
    analysis.score += 5;
  }

  // Generate recommendations
  if (analysis.internalLinks < 5) {
    analysis.recommendations.push(
      `Only ${analysis.internalLinks} internal links found - add more for better AI crawlability`
    );
  }

  if (analysis.internalLinkRatio < 50 && analysis.externalLinks > 0) {
    analysis.recommendations.push(
      `Internal link ratio is low (${analysis.internalLinkRatio}%) - balance internal vs external links`
    );
  }

  if (descriptivePercent < 60) {
    const nonDescriptive = analysis.totalLinks - analysis.linksWithDescriptiveText;
    analysis.recommendations.push(
      `${nonDescriptive} links lack descriptive anchor text - improve for AI context understanding`
    );
  }

  if (analysis.linkDensity < 1) {
    analysis.recommendations.push(
      'Link density is low - add more contextual internal links for AI navigation'
    );
  } else if (analysis.linkDensity > 5) {
    analysis.recommendations.push(
      'Link density is high - too many links may dilute page authority for AI'
    );
  }

  if (!analysis.hasNavigationSchema) {
    analysis.recommendations.push(
      'Add BreadcrumbList or SiteNavigationElement schema for navigation clarity'
    );
  }

  if (!analysis.hasSitemapLink) {
    analysis.recommendations.push(
      'Add link to XML sitemap for AI crawler discovery'
    );
  }

  if (analysis.emptyLinks > 0) {
    analysis.recommendations.push(
      `Fix ${analysis.emptyLinks} empty or placeholder links`
    );
  }

  console.log('[Internal Linking] Internal links:', analysis.internalLinks);
  console.log('[Internal Linking] Internal link ratio:', analysis.internalLinkRatio + '%');
  console.log('[Internal Linking] Link density:', analysis.linkDensity + '%');
  console.log('[Internal Linking] Score:', analysis.score);

  return analysis;
}

module.exports = { analyzeInternalLinkingDepth };
