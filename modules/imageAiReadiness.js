// modules/imageAiReadiness.js
// Analyzes image AI-readiness (descriptive text, structured markup)

/**
 * Analyze images for AI accessibility and structured markup
 */
function analyzeImageAiReadiness(schemas, html) {
  const analysis = {
    score: 0,
    maxScore: 100,
    imagesInSchema: 0,
    imagesWithCaption: 0,
    imagesWithAlt: 0,
    totalHtmlImages: 0,
    imagesWithDescriptiveAlt: 0,
    schemaImageObjects: 0,
    hasImageList: false,
    recommendations: []
  };

  // Extract images from HTML
  const imgRegex = /<img[^>]*>/gi;
  const imgMatches = html.match(imgRegex) || [];
  analysis.totalHtmlImages = imgMatches.length;

  // Check HTML images for alt text
  imgMatches.forEach(imgTag => {
    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    if (altMatch && altMatch[1]) {
      analysis.imagesWithAlt++;

      // Check if alt text is descriptive (more than just filename or generic text)
      const altText = altMatch[1].toLowerCase();
      const isDescriptive = altText.length > 15 &&
                           !altText.includes('img_') &&
                           !altText.includes('image') &&
                           !altText.includes('photo') &&
                           !altText.includes('picture') &&
                           !altText.includes('.jpg') &&
                           !altText.includes('.png');

      if (isDescriptive) {
        analysis.imagesWithDescriptiveAlt++;
      }
    }
  });

  // Analyze schema images
  schemas.forEach(schema => {
    // Check for image property
    if (schema.image) {
      const images = Array.isArray(schema.image) ? schema.image : [schema.image];

      images.forEach(img => {
        analysis.imagesInSchema++;

        // Check if image is an ImageObject (structured)
        if (typeof img === 'object' && img['@type'] === 'ImageObject') {
          analysis.schemaImageObjects++;

          if (img.caption) {
            analysis.imagesWithCaption++;
          }
        }
      });

      if (images.length > 1) {
        analysis.hasImageList = true;
      }
    }

    // Check for photo arrays in room/lodging schemas
    if (schema['@type'] === 'HotelRoom' || schema['@type'] === 'Hotel') {
      if (schema.photo) {
        const photos = Array.isArray(schema.photo) ? schema.photo : [schema.photo];
        photos.forEach(photo => {
          if (typeof photo === 'object' && photo['@type'] === 'ImageObject') {
            analysis.schemaImageObjects++;
            if (photo.caption) {
              analysis.imagesWithCaption++;
            }
          }
        });
      }
    }
  });

  // Scoring
  if (analysis.totalHtmlImages > 0) {
    const altTextPercent = (analysis.imagesWithAlt / analysis.totalHtmlImages) * 100;
    const descriptivePercent = (analysis.imagesWithDescriptiveAlt / analysis.totalHtmlImages) * 100;

    if (altTextPercent >= 90) {
      analysis.score += 25;
    } else if (altTextPercent >= 70) {
      analysis.score += 15;
    } else if (altTextPercent >= 50) {
      analysis.score += 5;
    }

    if (descriptivePercent >= 70) {
      analysis.score += 25;
    } else if (descriptivePercent >= 50) {
      analysis.score += 15;
    } else if (descriptivePercent >= 30) {
      analysis.score += 5;
    }
  }

  if (analysis.imagesInSchema > 0) {
    analysis.score += 20;
  }

  if (analysis.schemaImageObjects > 0) {
    analysis.score += 20;
  }

  if (analysis.imagesWithCaption > 0) {
    analysis.score += 10;
  }

  // Generate recommendations
  if (analysis.totalHtmlImages === 0) {
    analysis.recommendations.push(
      'No images found on page - visual content helps AI understanding'
    );
  } else {
    const missingAlt = analysis.totalHtmlImages - analysis.imagesWithAlt;
    if (missingAlt > 0) {
      analysis.recommendations.push(
        `${missingAlt} of ${analysis.totalHtmlImages} images missing alt text`
      );
    }

    const nonDescriptive = analysis.imagesWithAlt - analysis.imagesWithDescriptiveAlt;
    if (nonDescriptive > 0) {
      analysis.recommendations.push(
        `${nonDescriptive} images have generic alt text - make it descriptive for AI`
      );
    }
  }

  if (analysis.imagesInSchema === 0) {
    analysis.recommendations.push(
      'Add image URLs to schema markup for visual recognition by AI'
    );
  }

  if (analysis.schemaImageObjects === 0 && analysis.imagesInSchema > 0) {
    analysis.recommendations.push(
      'Use ImageObject type in schema (not just URL strings) for better AI understanding'
    );
  }

  if (analysis.imagesWithCaption === 0 && analysis.imagesInSchema > 0) {
    analysis.recommendations.push(
      'Add captions to ImageObjects for richer AI context'
    );
  }

  console.log('[Image AI] HTML images:', analysis.totalHtmlImages);
  console.log('[Image AI] Images with descriptive alt:', analysis.imagesWithDescriptiveAlt);
  console.log('[Image AI] Schema images:', analysis.imagesInSchema);
  console.log('[Image AI] Score:', analysis.score);

  return analysis;
}

module.exports = { analyzeImageAiReadiness };
