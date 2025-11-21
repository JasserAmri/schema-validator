// modules/contentStaleness.js
// Analyzes content freshness beyond just date fields

/**
 * Patterns that indicate stale or outdated content
 */
const STALENESS_INDICATORS = {
  oldYearReferences: {
    pattern: /\b(2019|2020|2021|2022)\b/g,
    severity: 'medium',
    message: 'References to old years found in content'
  },
  temporalPhrases: {
    patterns: [
      /this year/gi,
      /last year/gi,
      /next year/gi,
      /coming soon/gi,
      /recently opened/gi,
      /new for \d{4}/gi
    ],
    severity: 'low',
    message: 'Temporal phrases that may become outdated'
  },
  covidReferences: {
    patterns: [
      /covid-19 restrictions/gi,
      /pandemic measures/gi,
      /due to coronavirus/gi,
      /covid safety/gi
    ],
    severity: 'high',
    message: 'COVID-19 references may be outdated'
  },
  brokenTimeReferences: {
    patterns: [
      /updated: \d{1,2}\/\d{1,2}\/\d{4}/gi,
      /last updated/gi,
      /as of \d{4}/gi
    ],
    severity: 'low',
    message: 'Update dates found - verify they are current'
  }
};

/**
 * Analyze content staleness beyond date validation
 */
function analyzeContentStaleness(html, schemas) {
  const analysis = {
    score: 100, // Start perfect, deduct for staleness
    stalenessIndicators: [],
    hasRecentPublishDate: false,
    hasRecentModifiedDate: false,
    publishDate: null,
    modifiedDate: null,
    daysOld: null,
    yearReferences: [],
    temporalPhrases: [],
    outdatedContent: [],
    recommendations: []
  };

  const currentYear = new Date().getFullYear();
  const htmlLower = html.toLowerCase();

  // Check schema dates first
  schemas.forEach(schema => {
    if (schema.datePublished) {
      analysis.publishDate = schema.datePublished;
      const publishDate = new Date(schema.datePublished);
      const daysOld = Math.floor((Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24));
      analysis.daysOld = daysOld;

      if (daysOld <= 180) { // 6 months
        analysis.hasRecentPublishDate = true;
      }
    }

    if (schema.dateModified) {
      analysis.modifiedDate = schema.dateModified;
      const modifiedDate = new Date(schema.dateModified);
      const daysSinceModified = Math.floor((Date.now() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceModified <= 90) { // 3 months
        analysis.hasRecentModifiedDate = true;
      }
    }
  });

  // Check for old year references
  const yearMatches = html.match(/\b(2019|2020|2021|2022|2023)\b/g);
  if (yearMatches) {
    const uniqueYears = [...new Set(yearMatches)];
    analysis.yearReferences = uniqueYears;

    // Only flag as stale if years are significantly old
    const oldYears = uniqueYears.filter(year => currentYear - parseInt(year) > 2);
    if (oldYears.length > 0) {
      analysis.stalenessIndicators.push({
        type: 'old-year-references',
        severity: 'medium',
        count: oldYears.length,
        years: oldYears,
        message: `References to years ${oldYears.join(', ')} found - content may be outdated`
      });
      analysis.score -= 15;
    }
  }

  // Check for temporal phrases
  STALENESS_INDICATORS.temporalPhrases.patterns.forEach((pattern, index) => {
    const matches = html.match(pattern);
    if (matches) {
      analysis.temporalPhrases.push(...matches);
    }
  });

  if (analysis.temporalPhrases.length > 0) {
    analysis.stalenessIndicators.push({
      type: 'temporal-phrases',
      severity: 'low',
      count: analysis.temporalPhrases.length,
      examples: analysis.temporalPhrases.slice(0, 3),
      message: 'Temporal phrases found that may become outdated'
    });
    analysis.score -= 5;
  }

  // Check for COVID-19 references (likely outdated now)
  const covidMatches = [];
  STALENESS_INDICATORS.covidReferences.patterns.forEach(pattern => {
    const matches = html.match(pattern);
    if (matches) {
      covidMatches.push(...matches);
    }
  });

  if (covidMatches.length > 0) {
    analysis.stalenessIndicators.push({
      type: 'covid-references',
      severity: 'high',
      count: covidMatches.length,
      message: 'COVID-19 restriction references may be outdated'
    });
    analysis.score -= 20;
    analysis.outdatedContent.push('COVID-19 restrictions');
  }

  // Check for "coming soon" or "opening soon" without dates
  const comingSoonRegex = /coming soon|opening soon|will be available/gi;
  const comingSoonMatches = html.match(comingSoonRegex);
  if (comingSoonMatches && comingSoonMatches.length > 0) {
    analysis.stalenessIndicators.push({
      type: 'vague-future-references',
      severity: 'medium',
      count: comingSoonMatches.length,
      message: 'Vague future references without specific dates'
    });
    analysis.score -= 10;
  }

  // Check for very old "last updated" text in content
  const lastUpdatedRegex = /last updated:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-](\d{2,4}))/gi;
  let lastUpdatedMatch;
  while ((lastUpdatedMatch = lastUpdatedRegex.exec(html)) !== null) {
    const yearStr = lastUpdatedMatch[2];
    let year = parseInt(yearStr);

    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    if (currentYear - year > 1) {
      analysis.stalenessIndicators.push({
        type: 'old-update-date',
        severity: 'high',
        year: year,
        message: `Content shows "last updated" date from ${year}`
      });
      analysis.score -= 20;
    }
  }

  // Check if content has ANY date information
  const hasDateInfo = analysis.publishDate || analysis.modifiedDate ||
                      html.match(/\b(2024|2025|2026)\b/);

  if (!hasDateInfo) {
    analysis.stalenessIndicators.push({
      type: 'no-date-information',
      severity: 'medium',
      message: 'No date information found - AI cannot determine freshness'
    });
    analysis.score -= 15;
  }

  // Bonus for recent updates
  if (analysis.hasRecentModifiedDate) {
    analysis.score += 10; // Bonus for keeping content fresh
  }

  if (analysis.hasRecentPublishDate && !analysis.hasRecentModifiedDate) {
    // Published recently but never modified - that's okay
    analysis.score += 5;
  }

  // Ensure score doesn't go below 0 or above 100
  analysis.score = Math.max(0, Math.min(100, analysis.score));

  // Generate recommendations
  if (analysis.stalenessIndicators.length === 0) {
    analysis.recommendations.push(
      'Content appears fresh - no obvious staleness indicators detected'
    );
  } else {
    if (analysis.outdatedContent.length > 0) {
      analysis.recommendations.push(
        `Remove or update outdated content: ${analysis.outdatedContent.join(', ')}`
      );
    }

    if (analysis.yearReferences.some(y => currentYear - parseInt(y) > 2)) {
      analysis.recommendations.push(
        'Update old year references to keep content current'
      );
    }

    if (analysis.temporalPhrases.length > 0) {
      analysis.recommendations.push(
        'Replace temporal phrases ("this year", "recently") with specific dates'
      );
    }

    if (!analysis.hasRecentModifiedDate && analysis.daysOld > 365) {
      analysis.recommendations.push(
        'Content is over 1 year old - update dateModified in schema after reviewing content'
      );
    }

    if (!hasDateInfo) {
      analysis.recommendations.push(
        'Add datePublished and dateModified to schema for AI freshness signals'
      );
    }
  }

  console.log('[Content Staleness] Staleness indicators:', analysis.stalenessIndicators.length);
  console.log('[Content Staleness] Days old:', analysis.daysOld || 'unknown');
  console.log('[Content Staleness] Score:', analysis.score);

  return analysis;
}

module.exports = { analyzeContentStaleness };
