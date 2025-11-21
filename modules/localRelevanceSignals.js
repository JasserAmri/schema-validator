// modules/localRelevanceSignals.js
// Checks local SEO signals important for AI assistants

/**
 * Analyze local relevance signals for location-based AI queries
 */
function analyzeLocalRelevanceSignals(schemas, html) {
  const analysis = {
    score: 0,
    maxScore: 100,
    hasCompleteAddress: false,
    hasGeoCoordinates: false,
    hasTelephone: false,
    hasOpeningHours: false,
    hasAreaServed: false,
    hasNearbyLandmarks: false,
    addressComponents: {
      streetAddress: false,
      postalCode: false,
      addressLocality: false,
      addressCountry: false
    },
    recommendations: []
  };

  const htmlLower = html.toLowerCase();

  schemas.forEach(schema => {
    const schemaType = schema['@type'];

    if (schemaType && (schemaType.includes('Hotel') ||
                       schemaType.includes('LodgingBusiness') ||
                       schemaType.includes('Place'))) {

      // Check address completeness
      if (schema.address) {
        const address = schema.address;

        if (address.streetAddress) {
          analysis.addressComponents.streetAddress = true;
        }
        if (address.postalCode) {
          analysis.addressComponents.postalCode = true;
        }
        if (address.addressLocality) {
          analysis.addressComponents.addressLocality = true;
        }
        if (address.addressCountry) {
          analysis.addressComponents.addressCountry = true;
        }

        // Check if all components present
        if (analysis.addressComponents.streetAddress &&
            analysis.addressComponents.postalCode &&
            analysis.addressComponents.addressLocality &&
            analysis.addressComponents.addressCountry) {
          analysis.hasCompleteAddress = true;
          analysis.score += 30;
        } else {
          analysis.score += 10;
        }
      }

      // Check geo coordinates
      if (schema.geo) {
        if (schema.geo.latitude && schema.geo.longitude) {
          analysis.hasGeoCoordinates = true;
          analysis.score += 25;
        }
      }

      // Check telephone
      if (schema.telephone) {
        analysis.hasTelephone = true;
        analysis.score += 15;
      }

      // Check opening hours
      if (schema.openingHoursSpecification || schema.openingHours) {
        analysis.hasOpeningHours = true;
        analysis.score += 15;
      }

      // Check area served
      if (schema.areaServed) {
        analysis.hasAreaServed = true;
        analysis.score += 10;
      }
    }
  });

  // Check for nearby landmarks in content (AI context signal)
  const landmarkKeywords = [
    'near', 'close to', 'minutes from', 'walking distance',
    'metro', 'subway', 'train station', 'airport',
    'museum', 'landmark', 'monument', 'attraction'
  ];

  const hasLandmarkMentions = landmarkKeywords.some(keyword =>
    htmlLower.includes(keyword)
  );

  if (hasLandmarkMentions) {
    analysis.hasNearbyLandmarks = true;
    analysis.score += 5;
  }

  // Generate recommendations
  if (!analysis.hasCompleteAddress) {
    const missing = [];
    if (!analysis.addressComponents.streetAddress) missing.push('streetAddress');
    if (!analysis.addressComponents.postalCode) missing.push('postalCode');
    if (!analysis.addressComponents.addressLocality) missing.push('addressLocality');
    if (!analysis.addressComponents.addressCountry) missing.push('addressCountry');

    analysis.recommendations.push(
      `Complete address schema - missing: ${missing.join(', ')}`
    );
  }

  if (!analysis.hasGeoCoordinates) {
    analysis.recommendations.push(
      'Add geo coordinates (latitude/longitude) for precise location mapping'
    );
  }

  if (!analysis.hasTelephone) {
    analysis.recommendations.push(
      'Add telephone number for direct contact via AI assistants'
    );
  }

  if (!analysis.hasOpeningHours) {
    analysis.recommendations.push(
      'Add openingHoursSpecification for AI query responses about availability'
    );
  }

  if (!analysis.hasNearbyLandmarks) {
    analysis.recommendations.push(
      'Mention nearby landmarks or attractions for location context'
    );
  }

  console.log('[Local Relevance] Score:', analysis.score);
  console.log('[Local Relevance] Complete address:', analysis.hasCompleteAddress);
  console.log('[Local Relevance] Geo coordinates:', analysis.hasGeoCoordinates);

  return analysis;
}

module.exports = { analyzeLocalRelevanceSignals };
