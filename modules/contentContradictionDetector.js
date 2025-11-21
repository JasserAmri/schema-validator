// modules/contentContradictionDetector.js
// Detects contradictions between schema values and visible content

const { safeString } = require('../utils/safeString');

/**
 * Extract numbers from text for comparison
 */
function extractNumbers(text) {
  const matches = text.match(/\d+/g);
  return matches ? matches.map(n => parseInt(n, 10)) : [];
}

/**
 * Detect contradictions between schema and content
 */
function detectContentContradictions(schemas, html) {
  const analysis = {
    score: 100, // Start at perfect, deduct for contradictions
    contradictions: [],
    warnings: [],
    checks: {
      priceConsistency: 'not-checked',
      ratingConsistency: 'not-checked',
      addressConsistency: 'not-checked',
      phoneConsistency: 'not-checked',
      nameConsistency: 'not-checked'
    },
    recommendations: []
  };

  const htmlLower = html.toLowerCase();

  schemas.forEach((schema, schemaIndex) => {
    const schemaType = schema['@type'];

    // Check price consistency
    if (schema.priceRange) {
      analysis.checks.priceConsistency = 'checked';

      const schemaPriceNumbers = extractNumbers(schema.priceRange);
      const htmlPriceRegex = /\$\s*\d+|\d+\s*(?:usd|eur|gbp)|from\s+\d+|starting\s+at\s+\d+/gi;
      const htmlPrices = html.match(htmlPriceRegex);

      if (htmlPrices && htmlPrices.length > 0) {
        const htmlPriceNumbers = [];
        htmlPrices.forEach(price => {
          const nums = extractNumbers(price);
          htmlPriceNumbers.push(...nums);
        });

        // Check if schema price appears in content
        const schemaPriceInContent = schemaPriceNumbers.some(schemaNum =>
          htmlPriceNumbers.some(htmlNum => Math.abs(htmlNum - schemaNum) < 10)
        );

        if (!schemaPriceInContent && schemaPriceNumbers.length > 0) {
          analysis.contradictions.push({
            type: 'price-mismatch',
            severity: 'medium',
            schemaValue: schema.priceRange,
            contentValues: htmlPrices.slice(0, 3),
            message: `Schema price "${schema.priceRange}" not found in visible content prices`
          });
          analysis.score -= 15;
        }
      }
    }

    // Check rating consistency
    if (schema.aggregateRating) {
      analysis.checks.ratingConsistency = 'checked';

      const schemaRating = parseFloat(schema.aggregateRating.ratingValue);
      const ratingRegex = /(\d+\.?\d*)\s*(?:out of|\/)\s*(\d+)|rating:\s*(\d+\.?\d*)/gi;
      const htmlRatings = [...html.matchAll(ratingRegex)];

      if (htmlRatings.length > 0) {
        const htmlRatingValues = htmlRatings.map(match =>
          parseFloat(match[1] || match[3])
        ).filter(v => !isNaN(v));

        const ratingInContent = htmlRatingValues.some(rating =>
          Math.abs(rating - schemaRating) < 0.2
        );

        if (!ratingInContent) {
          analysis.contradictions.push({
            type: 'rating-mismatch',
            severity: 'high',
            schemaValue: schemaRating,
            contentValues: htmlRatingValues.slice(0, 3),
            message: `Schema rating ${schemaRating} differs from visible content ratings`
          });
          analysis.score -= 20;
        }
      }
    }

    // Check name consistency
    if (schema.name) {
      analysis.checks.nameConsistency = 'checked';

      const schemaName = safeString(schema.name).toLowerCase();
      const schemaNameWords = schemaName.split(/\s+/).filter(w => w.length > 3);

      // Check if major words from schema name appear in content
      const nameWordsInContent = schemaNameWords.filter(word =>
        htmlLower.includes(word)
      );

      if (nameWordsInContent.length < schemaNameWords.length * 0.6) {
        analysis.warnings.push({
          type: 'name-not-prominent',
          severity: 'low',
          schemaValue: schema.name,
          message: `Schema name "${schema.name}" not prominently visible in content`
        });
        analysis.score -= 5;
      }
    }

    // Check address consistency
    if (schema.address) {
      analysis.checks.addressConsistency = 'checked';

      const address = schema.address;
      const addressParts = [
        address.streetAddress,
        address.addressLocality,
        address.postalCode
      ].filter(Boolean);

      const addressPartsInContent = addressParts.filter(part =>
        htmlLower.includes(safeString(part).toLowerCase())
      );

      if (addressPartsInContent.length < addressParts.length * 0.5) {
        analysis.warnings.push({
          type: 'address-not-visible',
          severity: 'medium',
          schemaValue: addressParts.join(', '),
          message: 'Schema address not clearly visible in page content'
        });
        analysis.score -= 10;
      }
    }

    // Check telephone consistency
    if (schema.telephone) {
      analysis.checks.phoneConsistency = 'checked';

      const schemaPhone = safeString(schema.telephone).replace(/\D/g, '');
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const htmlPhones = html.match(phoneRegex) || [];

      const phoneInContent = htmlPhones.some(phone => {
        const htmlPhone = phone.replace(/\D/g, '');
        return htmlPhone.includes(schemaPhone.slice(-7)) || schemaPhone.includes(htmlPhone.slice(-7));
      });

      if (!phoneInContent) {
        analysis.warnings.push({
          type: 'phone-not-visible',
          severity: 'low',
          schemaValue: schema.telephone,
          message: 'Schema telephone number not visible in content'
        });
        analysis.score -= 5;
      }
    }
  });

  // Ensure score doesn't go below 0
  analysis.score = Math.max(0, analysis.score);

  // Generate recommendations
  if (analysis.contradictions.length > 0) {
    analysis.recommendations.push(
      `Fix ${analysis.contradictions.length} data contradiction(s) between schema and content`
    );

    // Specific recommendations by type
    const priceIssues = analysis.contradictions.filter(c => c.type === 'price-mismatch');
    if (priceIssues.length > 0) {
      analysis.recommendations.push(
        'Ensure price in schema matches visible prices on page'
      );
    }

    const ratingIssues = analysis.contradictions.filter(c => c.type === 'rating-mismatch');
    if (ratingIssues.length > 0) {
      analysis.recommendations.push(
        'Update schema rating to match current displayed rating'
      );
    }
  }

  if (analysis.warnings.length > 0) {
    analysis.recommendations.push(
      `Address ${analysis.warnings.length} visibility warning(s) for better AI verification`
    );
  }

  console.log('[Contradiction Detector] Contradictions:', analysis.contradictions.length);
  console.log('[Contradiction Detector] Warnings:', analysis.warnings.length);
  console.log('[Contradiction Detector] Score:', analysis.score);

  return analysis;
}

module.exports = { detectContentContradictions };
