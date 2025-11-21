// modules/summaryDetector.js
// Detects AI-ready summary fields in schema

/**
 * Detect presence of summary/description fields optimized for AI
 */
function detectAiReadySummaries(schemas, html) {
  const analysis = {
    score: 0,
    maxScore: 100,
    hasDescription: false,
    hasAbstract: false,
    hasSummary: false,
    hasDisambiguatingDescription: false,
    descriptionQuality: {
      length: 0,
      hasKeywords: false,
      isDescriptive: false,
      wordCount: 0
    },
    metaDescription: null,
    metaDescriptionQuality: {
      present: false,
      length: 0,
      matchesSchema: false
    },
    recommendations: []
  };

  // Extract meta description from HTML
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  if (metaDescMatch) {
    analysis.metaDescription = metaDescMatch[1];
    analysis.metaDescriptionQuality.present = true;
    analysis.metaDescriptionQuality.length = metaDescMatch[1].length;
    analysis.score += 15;
  }

  let bestDescription = null;
  let bestDescriptionLength = 0;

  schemas.forEach(schema => {
    const schemaType = schema['@type'];

    if (schemaType && (schemaType.includes('Hotel') ||
                       schemaType.includes('LodgingBusiness') ||
                       schemaType.includes('Organization'))) {

      // Check for description
      if (schema.description) {
        analysis.hasDescription = true;
        const descLength = schema.description.length;

        if (descLength > bestDescriptionLength) {
          bestDescription = schema.description;
          bestDescriptionLength = descLength;
        }
      }

      // Check for abstract (less common but valuable)
      if (schema.abstract) {
        analysis.hasAbstract = true;
        analysis.score += 10;
      }

      // Check for summary (even less common)
      if (schema.summary) {
        analysis.hasSummary = true;
        analysis.score += 10;
      }

      // Check for disambiguatingDescription (great for AI)
      if (schema.disambiguatingDescription) {
        analysis.hasDisambiguatingDescription = true;
        analysis.score += 20;
      }
    }
  });

  // Analyze description quality
  if (bestDescription) {
    analysis.descriptionQuality.length = bestDescriptionLength;
    analysis.descriptionQuality.wordCount = bestDescription.split(/\s+/).length;

    // Check if description is substantial
    if (bestDescriptionLength >= 100 && bestDescriptionLength <= 500) {
      analysis.descriptionQuality.isDescriptive = true;
      analysis.score += 25;
    } else if (bestDescriptionLength > 50) {
      analysis.score += 15;
    } else if (bestDescriptionLength > 0) {
      analysis.score += 5;
    }

    // Check for important keywords in description
    const importantKeywords = ['hotel', 'room', 'guest', 'service', 'amenity', 'location', 'experience'];
    const descLower = bestDescription.toLowerCase();

    const keywordCount = importantKeywords.filter(kw => descLower.includes(kw)).length;
    if (keywordCount >= 3) {
      analysis.descriptionQuality.hasKeywords = true;
      analysis.score += 10;
    }

    // Check if meta description matches schema description
    if (analysis.metaDescription) {
      const similarity = calculateSimilarity(
        bestDescription.toLowerCase(),
        analysis.metaDescription.toLowerCase()
      );

      if (similarity > 0.7) {
        analysis.metaDescriptionQuality.matchesSchema = true;
        analysis.score += 10;
      }
    }
  }

  // Generate recommendations
  if (!analysis.hasDescription) {
    analysis.recommendations.push(
      'Add description property to schema - critical for AI understanding'
    );
  } else {
    if (analysis.descriptionQuality.length < 100) {
      analysis.recommendations.push(
        `Description too short (${analysis.descriptionQuality.length} chars) - expand to 100-500 characters`
      );
    } else if (analysis.descriptionQuality.length > 500) {
      analysis.recommendations.push(
        `Description too long (${analysis.descriptionQuality.length} chars) - keep under 500 characters`
      );
    }

    if (!analysis.descriptionQuality.hasKeywords) {
      analysis.recommendations.push(
        'Add relevant keywords to description (hotel, rooms, amenities, location, etc.)'
      );
    }
  }

  if (!analysis.hasDisambiguatingDescription) {
    analysis.recommendations.push(
      'Add disambiguatingDescription for unique differentiators (e.g., "Boutique hotel in historic Marais district")'
    );
  }

  if (!analysis.metaDescriptionQuality.present) {
    analysis.recommendations.push(
      'Add meta description tag for search engines and AI systems'
    );
  } else if (!analysis.metaDescriptionQuality.matchesSchema && analysis.hasDescription) {
    analysis.recommendations.push(
      'Meta description differs from schema description - keep them consistent'
    );
  }

  console.log('[Summary Detector] Has description:', analysis.hasDescription);
  console.log('[Summary Detector] Description length:', analysis.descriptionQuality.length);
  console.log('[Summary Detector] Score:', analysis.score);

  return analysis;
}

/**
 * Simple string similarity calculator (Dice coefficient)
 */
function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const similarity = (2 * intersection.size) / (words1.size + words2.size);

  return similarity;
}

module.exports = { detectAiReadySummaries };
