// modules/policyCompleteness.js
// Deep analysis of hotel policies in schema vs content

/**
 * Policy types that AI assistants look for
 */
const POLICY_TYPES = {
  cancellation: {
    schemaProperty: 'cancellationPolicy',
    keywords: ['cancellation', 'cancel', 'refund', 'non-refundable', 'free cancellation']
  },
  checkIn: {
    schemaProperty: 'checkinTime',
    keywords: ['check-in time', 'check in', 'arrival time', 'early check-in']
  },
  checkOut: {
    schemaProperty: 'checkoutTime',
    keywords: ['check-out time', 'check out', 'departure time', 'late check-out']
  },
  pets: {
    schemaProperty: 'petsAllowed',
    keywords: ['pets allowed', 'pet policy', 'pet-friendly', 'dogs allowed', 'no pets']
  },
  smoking: {
    schemaProperty: 'smokingAllowed',
    keywords: ['smoking', 'non-smoking', 'smoke-free', 'smoking policy']
  },
  children: {
    schemaProperty: null,
    keywords: ['children', 'kids', 'child policy', 'age requirement', 'family-friendly']
  },
  payment: {
    schemaProperty: 'paymentAccepted',
    keywords: ['payment', 'credit card', 'cash', 'deposit', 'payment methods']
  },
  breakfast: {
    schemaProperty: 'amenityFeature',
    keywords: ['breakfast included', 'breakfast policy', 'complimentary breakfast', 'breakfast available']
  }
};

/**
 * Analyze policy completeness in schema vs content
 */
function analyzePolicyCompleteness(schemas, html) {
  const analysis = {
    score: 0,
    maxScore: 100,
    policiesInSchema: [],
    policiesInContent: [],
    policiesInBoth: [],
    missingFromSchema: [],
    missingFromContent: [],
    detailedPolicies: {},
    recommendations: []
  };

  const htmlLower = html.toLowerCase();

  Object.entries(POLICY_TYPES).forEach(([policyName, config]) => {
    let foundInSchema = false;
    let foundInContent = false;
    let schemaValue = null;

    // Check in schema
    schemas.forEach(schema => {
      const schemaType = schema['@type'];

      if (schemaType && (schemaType.includes('Hotel') ||
                         schemaType.includes('LodgingBusiness') ||
                         schemaType.includes('HotelRoom'))) {

        if (config.schemaProperty && schema[config.schemaProperty]) {
          foundInSchema = true;
          schemaValue = schema[config.schemaProperty];
        }

        // Special check for amenityFeature (breakfast, etc.)
        if (config.schemaProperty === 'amenityFeature' && schema.amenityFeature) {
          const amenities = Array.isArray(schema.amenityFeature) ?
                          schema.amenityFeature : [schema.amenityFeature];

          amenities.forEach(amenity => {
            const amenityStr = typeof amenity === 'string' ?
                              amenity : (amenity.name || JSON.stringify(amenity));

            if (config.keywords.some(kw => amenityStr.toLowerCase().includes(kw))) {
              foundInSchema = true;
              schemaValue = amenityStr;
            }
          });
        }
      }
    });

    // Check in content
    const contentMatches = config.keywords.filter(keyword =>
      htmlLower.includes(keyword.toLowerCase())
    );

    if (contentMatches.length > 0) {
      foundInContent = true;
    }

    // Categorize policy
    if (foundInSchema && foundInContent) {
      analysis.policiesInBoth.push(policyName);
      analysis.score += 12.5; // 100 / 8 policies
    } else if (foundInSchema) {
      analysis.policiesInSchema.push(policyName);
      analysis.missingFromContent.push(policyName);
      analysis.score += 6;
    } else if (foundInContent) {
      analysis.policiesInContent.push(policyName);
      analysis.missingFromSchema.push(policyName);
      analysis.score += 3;
    }

    // Store detailed policy info
    analysis.detailedPolicies[policyName] = {
      inSchema: foundInSchema,
      inContent: foundInContent,
      schemaValue: schemaValue,
      contentMatches: contentMatches.length
    };
  });

  // Generate recommendations
  if (analysis.missingFromSchema.length > 0) {
    analysis.missingFromSchema.forEach(policy => {
      const config = POLICY_TYPES[policy];
      if (config.schemaProperty) {
        analysis.recommendations.push(
          `Add ${policy} to schema (${config.schemaProperty}) - mentioned in content but not in schema`
        );
      } else {
        analysis.recommendations.push(
          `Consider adding ${policy} policy to schema if applicable`
        );
      }
    });
  }

  if (analysis.missingFromContent.length > 0) {
    analysis.recommendations.push(
      `Policies in schema but not clearly explained in content: ${analysis.missingFromContent.join(', ')}`
    );
  }

  if (analysis.policiesInBoth.length === 0) {
    analysis.recommendations.push(
      'No policies found in both schema AND content - add comprehensive policy information'
    );
  }

  // Check for policy page URL
  const hasPolicyPage = htmlLower.includes('policy') &&
                       (htmlLower.includes('terms') || htmlLower.includes('conditions'));

  if (!hasPolicyPage) {
    analysis.recommendations.push(
      'Consider adding a dedicated policy page URL to schema (termsOfService property)'
    );
  }

  console.log('[Policy Completeness] Policies in both:', analysis.policiesInBoth.length);
  console.log('[Policy Completeness] Missing from schema:', analysis.missingFromSchema.length);
  console.log('[Policy Completeness] Score:', analysis.score);

  return analysis;
}

module.exports = { analyzePolicyCompleteness };
