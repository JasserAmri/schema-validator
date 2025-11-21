// modules/aiMetadataValidator.js
// Validates AI-specific metadata (OpenGraph, Twitter Cards, Apple tags)

/**
 * Validate AI-specific metadata tags
 */
function validateAiMetadata(html) {
  const analysis = {
    score: 0,
    maxScore: 100,
    openGraph: {
      present: false,
      title: null,
      description: null,
      image: null,
      type: null,
      url: null,
      siteName: null,
      completeness: 0
    },
    twitterCard: {
      present: false,
      card: null,
      title: null,
      description: null,
      image: null,
      completeness: 0
    },
    appleMeta: {
      present: false,
      mobileWebAppCapable: false,
      appleTouchIcon: false
    },
    canonical: {
      present: false,
      url: null
    },
    robots: {
      present: false,
      content: null,
      allowsIndexing: true,
      allowsCrawling: true
    },
    recommendations: []
  };

  const htmlLower = html.toLowerCase();

  // Check OpenGraph tags
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  const ogDescription = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
  const ogType = html.match(/<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']*)["']/i);
  const ogUrl = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["']/i);
  const ogSiteName = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i);

  if (ogTitle || ogDescription || ogImage) {
    analysis.openGraph.present = true;
  }

  if (ogTitle) {
    analysis.openGraph.title = ogTitle[1];
    analysis.openGraph.completeness += 20;
  }

  if (ogDescription) {
    analysis.openGraph.description = ogDescription[1];
    analysis.openGraph.completeness += 20;
  }

  if (ogImage) {
    analysis.openGraph.image = ogImage[1];
    analysis.openGraph.completeness += 25;
  }

  if (ogType) {
    analysis.openGraph.type = ogType[1];
    analysis.openGraph.completeness += 15;
  }

  if (ogUrl) {
    analysis.openGraph.url = ogUrl[1];
    analysis.openGraph.completeness += 10;
  }

  if (ogSiteName) {
    analysis.openGraph.siteName = ogSiteName[1];
    analysis.openGraph.completeness += 10;
  }

  // Score OpenGraph
  if (analysis.openGraph.completeness >= 80) {
    analysis.score += 35;
  } else if (analysis.openGraph.completeness >= 50) {
    analysis.score += 20;
  } else if (analysis.openGraph.completeness > 0) {
    analysis.score += 10;
  }

  // Check Twitter Card tags
  const twitterCard = html.match(/<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["']/i);
  const twitterTitle = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i);
  const twitterDesc = html.match(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']*)["']/i);
  const twitterImage = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']*)["']/i);

  if (twitterCard || twitterTitle || twitterDesc || twitterImage) {
    analysis.twitterCard.present = true;
  }

  if (twitterCard) {
    analysis.twitterCard.card = twitterCard[1];
    analysis.twitterCard.completeness += 25;
  }

  if (twitterTitle) {
    analysis.twitterCard.title = twitterTitle[1];
    analysis.twitterCard.completeness += 25;
  }

  if (twitterDesc) {
    analysis.twitterCard.description = twitterDesc[1];
    analysis.twitterCard.completeness += 25;
  }

  if (twitterImage) {
    analysis.twitterCard.image = twitterImage[1];
    analysis.twitterCard.completeness += 25;
  }

  // Score Twitter Card
  if (analysis.twitterCard.completeness >= 75) {
    analysis.score += 25;
  } else if (analysis.twitterCard.completeness >= 50) {
    analysis.score += 15;
  } else if (analysis.twitterCard.completeness > 0) {
    analysis.score += 5;
  }

  // Check Apple meta tags
  const appleMobileCapable = html.match(/<meta[^>]*name=["']apple-mobile-web-app-capable["']/i);
  const appleTouchIcon = html.match(/<link[^>]*rel=["']apple-touch-icon["']/i);

  if (appleMobileCapable) {
    analysis.appleMeta.mobileWebAppCapable = true;
    analysis.appleMeta.present = true;
    analysis.score += 5;
  }

  if (appleTouchIcon) {
    analysis.appleMeta.appleTouchIcon = true;
    analysis.appleMeta.present = true;
    analysis.score += 5;
  }

  // Check canonical URL
  const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  if (canonical) {
    analysis.canonical.present = true;
    analysis.canonical.url = canonical[1];
    analysis.score += 15;
  }

  // Check robots meta
  const robotsMeta = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  if (robotsMeta) {
    analysis.robots.present = true;
    analysis.robots.content = robotsMeta[1];

    const content = robotsMeta[1].toLowerCase();
    if (content.includes('noindex')) {
      analysis.robots.allowsIndexing = false;
      analysis.score -= 30; // Major penalty
    }

    if (content.includes('nofollow')) {
      analysis.robots.allowsCrawling = false;
      analysis.score -= 20;
    }

    // Bonus for good robots
    if (content.includes('index') && content.includes('follow')) {
      analysis.score += 10;
    }
  }

  // Generate recommendations
  if (!analysis.openGraph.present) {
    analysis.recommendations.push(
      'Add OpenGraph tags for social sharing and AI understanding'
    );
  } else {
    if (!analysis.openGraph.title) {
      analysis.recommendations.push('Add og:title tag');
    }
    if (!analysis.openGraph.description) {
      analysis.recommendations.push('Add og:description tag');
    }
    if (!analysis.openGraph.image) {
      analysis.recommendations.push('Add og:image tag - critical for visual AI systems');
    }
  }

  if (!analysis.twitterCard.present) {
    analysis.recommendations.push(
      'Add Twitter Card tags for social media AI processing'
    );
  } else if (analysis.twitterCard.completeness < 100) {
    analysis.recommendations.push(
      `Twitter Card incomplete (${analysis.twitterCard.completeness}%) - add missing tags`
    );
  }

  if (!analysis.canonical.present) {
    analysis.recommendations.push(
      'Add canonical URL to prevent duplicate content issues with AI indexing'
    );
  }

  if (!analysis.robots.allowsIndexing) {
    analysis.recommendations.push(
      'WARNING: robots meta tag blocks indexing - remove "noindex" for AI visibility'
    );
  }

  if (!analysis.robots.allowsCrawling) {
    analysis.recommendations.push(
      'WARNING: robots meta tag blocks following links - remove "nofollow" for better AI crawling'
    );
  }

  // Ensure score doesn't go below 0
  analysis.score = Math.max(0, analysis.score);

  console.log('[AI Metadata] OpenGraph completeness:', analysis.openGraph.completeness + '%');
  console.log('[AI Metadata] Twitter Card completeness:', analysis.twitterCard.completeness + '%');
  console.log('[AI Metadata] Score:', analysis.score);

  return analysis;
}

module.exports = { validateAiMetadata };
