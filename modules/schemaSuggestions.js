// modules/schemaSuggestions.js
// Suggests missing schema types based on content detection

/**
 * Content patterns that suggest specific schema types
 */
const SCHEMA_SUGGESTIONS = {
  FAQPage: {
    keywords: ['faq', 'frequently asked questions', 'common questions', 'q&a', 'questions and answers'],
    patterns: [/question:\s*/i, /<h[2-4][^>]*>.*\?/i],
    description: 'FAQPage schema for question/answer content'
  },
  HowTo: {
    keywords: ['how to', 'step-by-step', 'instructions', 'guide', 'tutorial'],
    patterns: [/step\s+\d+/i, /first.*then.*finally/i],
    description: 'HowTo schema for instructional content'
  },
  Restaurant: {
    keywords: ['restaurant', 'dining', 'menu', 'cuisine', 'chef', 'reservation'],
    patterns: [/menu|breakfast|lunch|dinner/i],
    description: 'Restaurant schema if hotel has on-site restaurant'
  },
  SportsActivityLocation: {
    keywords: ['spa', 'fitness', 'gym', 'wellness', 'massage', 'sauna'],
    patterns: [/spa services|fitness center|wellness/i],
    description: 'SportsActivityLocation schema for spa/fitness facilities'
  },
  Event: {
    keywords: ['event', 'conference', 'meeting', 'wedding', 'celebration', 'banquet'],
    patterns: [/event space|meeting room|conference hall/i],
    description: 'Event schema for event hosting capabilities'
  },
  Review: {
    keywords: ['review', 'testimonial', 'guest says', 'customer feedback'],
    patterns: [/"[^"]{50,}".*-\s*\w+/i, /★+|⭐+/],
    description: 'Review schema for individual guest reviews'
  },
  Offer: {
    keywords: ['special offer', 'promotion', 'deal', 'discount', 'package'],
    patterns: [/\d+%\s*off|save\s*\$|limited time/i],
    description: 'Offer schema for special deals and promotions'
  },
  TouristAttraction: {
    keywords: ['attraction', 'landmark', 'museum', 'monument', 'tourist', 'sightseeing'],
    patterns: [/near.*(?:museum|monument|attraction)/i],
    description: 'TouristAttraction schema for nearby points of interest'
  },
  VideoObject: {
    keywords: ['video', 'watch', 'virtual tour', 'youtube', 'vimeo'],
    patterns: [/<iframe[^>]*(?:youtube|vimeo)/i, /<video/i],
    description: 'VideoObject schema for embedded videos'
  },
  BreadcrumbList: {
    keywords: ['home', 'breadcrumb'],
    patterns: [/>\s*›\s*|>\s*\/\s*|>\s*>\s*/],
    description: 'BreadcrumbList schema for navigation breadcrumbs'
  }
};

/**
 * Suggest missing schema types based on content analysis
 */
function suggestMissingSchemas(schemas, html) {
  const analysis = {
    score: 0,
    maxScore: 100,
    existingTypes: [],
    suggestedSchemas: [],
    detectedContent: {},
    highPrioritySuggestions: [],
    recommendations: []
  };

  const htmlLower = html.toLowerCase();

  // Extract existing schema types
  schemas.forEach(schema => {
    const type = schema['@type'];
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      analysis.existingTypes.push(...types);
    }
  });

  // Check for each potential schema type
  Object.entries(SCHEMA_SUGGESTIONS).forEach(([schemaType, config]) => {
    // Skip if already exists
    if (analysis.existingTypes.includes(schemaType)) {
      analysis.score += 10; // Bonus for having it
      return;
    }

    let matches = 0;
    let matchedKeywords = [];
    let matchedPatterns = [];

    // Check keywords
    config.keywords.forEach(keyword => {
      if (htmlLower.includes(keyword.toLowerCase())) {
        matches++;
        matchedKeywords.push(keyword);
      }
    });

    // Check patterns
    config.patterns.forEach((pattern, index) => {
      if (pattern.test(html)) {
        matches += 2; // Patterns count more
        matchedPatterns.push(`pattern-${index}`);
      }
    });

    // If significant matches, suggest this schema
    if (matches >= 2) {
      const suggestion = {
        type: schemaType,
        description: config.description,
        confidence: matches >= 4 ? 'high' : 'medium',
        evidence: {
          keywords: matchedKeywords,
          patterns: matchedPatterns.length
        }
      };

      analysis.suggestedSchemas.push(suggestion);

      if (suggestion.confidence === 'high') {
        analysis.highPrioritySuggestions.push(schemaType);
      }

      analysis.detectedContent[schemaType] = {
        matches,
        keywords: matchedKeywords
      };
    }
  });

  // Calculate score based on suggestions
  // Lower score if many schemas are missing
  const totalPossibleSchemas = Object.keys(SCHEMA_SUGGESTIONS).length;
  const existingRelevantSchemas = analysis.existingTypes.filter(type =>
    Object.keys(SCHEMA_SUGGESTIONS).includes(type)
  ).length;

  const coveredPercent = (existingRelevantSchemas / totalPossibleSchemas) * 100;
  analysis.score = Math.round(coveredPercent);

  // High priority suggestions (deduct more points)
  if (analysis.highPrioritySuggestions.length > 0) {
    analysis.score = Math.max(0, analysis.score - (analysis.highPrioritySuggestions.length * 10));
  }

  // Generate recommendations
  if (analysis.suggestedSchemas.length > 0) {
    analysis.recommendations.push(
      `${analysis.suggestedSchemas.length} schema type(s) detected in content but missing from markup`
    );

    // Prioritize high-confidence suggestions
    analysis.highPrioritySuggestions.forEach(type => {
      const suggestion = analysis.suggestedSchemas.find(s => s.type === type);
      analysis.recommendations.push(
        `HIGH PRIORITY: Add ${type} schema - ${suggestion.description}`
      );
    });

    // Medium confidence suggestions
    analysis.suggestedSchemas
      .filter(s => s.confidence === 'medium')
      .slice(0, 3)
      .forEach(suggestion => {
        analysis.recommendations.push(
          `Consider adding ${suggestion.type} schema - ${suggestion.description}`
        );
      });
  } else {
    analysis.recommendations.push(
      'Good schema coverage - no obvious missing types detected'
    );
  }

  console.log('[Schema Suggestions] Suggested types:', analysis.suggestedSchemas.length);
  console.log('[Schema Suggestions] High priority:', analysis.highPrioritySuggestions.length);
  console.log('[Schema Suggestions] Score:', analysis.score);

  return analysis;
}

module.exports = { suggestMissingSchemas };
