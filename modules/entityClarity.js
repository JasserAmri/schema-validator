// modules/entityClarity.js
// Validates entity disambiguation and knowledge graph signals

/**
 * Analyze entity clarity for knowledge graphs
 * Checks if the business/hotel is clearly identifiable by AI systems
 */
function analyzeEntityClarity(schemas) {
  const analysis = {
    score: 0,
    maxScore: 100,
    hasWikipediaLink: false,
    hasWikidata: false,
    hasSameAs: false,
    socialProfilesComplete: false,
    socialProfiles: [],
    hasLogo: false,
    hasGlobalIdentifier: false,
    identifiers: [],
    recommendations: []
  };

  schemas.forEach(schema => {
    const schemaType = schema['@type'];

    if (schemaType && (schemaType.includes('Hotel') ||
                       schemaType.includes('LodgingBusiness') ||
                       schemaType.includes('Organization'))) {

      // Check for sameAs (knowledge base links)
      if (schema.sameAs) {
        const sameAsArray = Array.isArray(schema.sameAs) ? schema.sameAs : [schema.sameAs];

        sameAsArray.forEach(link => {
          const linkLower = link.toLowerCase();

          if (linkLower.includes('wikipedia.org')) {
            analysis.hasWikipediaLink = true;
            analysis.score += 25;
          }

          if (linkLower.includes('wikidata.org')) {
            analysis.hasWikidata = true;
            analysis.score += 25;
          }

          // Social profiles
          const socialDomains = ['facebook.com', 'twitter.com', 'instagram.com',
                                'linkedin.com', 'youtube.com'];
          socialDomains.forEach(domain => {
            if (linkLower.includes(domain)) {
              if (!analysis.socialProfiles.includes(domain)) {
                analysis.socialProfiles.push(domain);
              }
            }
          });
        });

        analysis.hasSameAs = true;
      }

      // Check for logo (visual entity signal)
      if (schema.logo) {
        analysis.hasLogo = true;
        analysis.score += 10;
      }

      // Check for global identifiers
      if (schema.identifier) {
        const identifiers = Array.isArray(schema.identifier) ?
                          schema.identifier : [schema.identifier];

        identifiers.forEach(id => {
          if (typeof id === 'object') {
            if (id.propertyID === 'DUNS' ||
                id.propertyID === 'LEI' ||
                id.propertyID === 'IATA') {
              analysis.identifiers.push(id.propertyID);
              analysis.hasGlobalIdentifier = true;
            }
          }
        });

        if (analysis.hasGlobalIdentifier) {
          analysis.score += 15;
        }
      }
    }
  });

  // Check social profile completeness
  if (analysis.socialProfiles.length >= 3) {
    analysis.socialProfilesComplete = true;
    analysis.score += 25;
  } else if (analysis.socialProfiles.length > 0) {
    analysis.score += 10;
  }

  // Generate recommendations
  if (!analysis.hasWikipediaLink && !analysis.hasWikidata) {
    analysis.recommendations.push(
      'Add Wikipedia or Wikidata link in sameAs property for knowledge graph recognition'
    );
  }

  if (!analysis.socialProfilesComplete) {
    analysis.recommendations.push(
      `Add more social profiles (found ${analysis.socialProfiles.length}, recommended 3+)`
    );
  }

  if (!analysis.hasLogo) {
    analysis.recommendations.push(
      'Add high-quality logo URL for visual entity recognition'
    );
  }

  if (!analysis.hasGlobalIdentifier) {
    analysis.recommendations.push(
      'Add global identifier (DUNS, LEI, or IATA code) for unique entity identification'
    );
  }

  console.log('[Entity Clarity] Score:', analysis.score);
  console.log('[Entity Clarity] Wikipedia:', analysis.hasWikipediaLink);
  console.log('[Entity Clarity] Social profiles:', analysis.socialProfiles.length);

  return analysis;
}

module.exports = { analyzeEntityClarity };
