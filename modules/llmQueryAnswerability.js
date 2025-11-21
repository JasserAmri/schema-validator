// modules/llmQueryAnswerability.js
// Analyzes if page content answers typical guest questions that AI models look for

/**
 * Common questions AI models try to answer about hotels
 */
const TYPICAL_GUEST_QUESTIONS = {
  'check-in time': {
    keywords: ['check-in', 'checkin', 'arrival time', 'check in time'],
    schemaPath: 'checkinTime'
  },
  'check-out time': {
    keywords: ['check-out', 'checkout', 'departure time', 'check out time'],
    schemaPath: 'checkoutTime'
  },
  'breakfast': {
    keywords: ['breakfast', 'morning meal', 'continental breakfast', 'breakfast included', 'complimentary breakfast'],
    schemaPath: 'amenityFeature'
  },
  'parking': {
    keywords: ['parking', 'car park', 'garage', 'valet', 'free parking', 'paid parking'],
    schemaPath: 'amenityFeature'
  },
  'pets': {
    keywords: ['pets', 'pet-friendly', 'pet friendly', 'dogs allowed', 'cats allowed', 'animals'],
    schemaPath: 'petsAllowed'
  },
  'wifi': {
    keywords: ['wifi', 'wi-fi', 'internet', 'free wifi', 'wireless'],
    schemaPath: 'amenityFeature'
  },
  'pool': {
    keywords: ['pool', 'swimming pool', 'indoor pool', 'outdoor pool'],
    schemaPath: 'amenityFeature'
  },
  'gym': {
    keywords: ['gym', 'fitness', 'fitness center', 'exercise', 'workout'],
    schemaPath: 'amenityFeature'
  },
  'cancellation': {
    keywords: ['cancellation', 'cancel', 'refund', 'cancellation policy', 'free cancellation'],
    schemaPath: null
  },
  'price': {
    keywords: ['price', 'rate', 'cost', 'from $', 'starting at', 'per night'],
    schemaPath: 'priceRange'
  }
};

/**
 * Analyze if page answers typical guest questions
 */
function analyzeLlmQueryAnswerability(html, schemas) {
  const analysis = {
    score: 0,
    maxScore: 100,
    answeredQuestions: [],
    missingQuestions: [],
    partiallyAnswered: [],
    schemaAnswers: 0,
    contentAnswers: 0,
    recommendations: []
  };

  const htmlLower = html.toLowerCase();

  Object.entries(TYPICAL_GUEST_QUESTIONS).forEach(([question, config]) => {
    let foundInSchema = false;
    let foundInContent = false;

    // Check in schema
    if (config.schemaPath) {
      schemas.forEach(schema => {
        const schemaType = schema['@type'];
        if (schemaType && (schemaType.includes('Hotel') || schemaType.includes('LodgingBusiness'))) {
          if (schema[config.schemaPath]) {
            foundInSchema = true;
          }
        }
      });
    }

    // Check in content
    const keywordMatches = config.keywords.filter(keyword =>
      htmlLower.includes(keyword.toLowerCase())
    );

    if (keywordMatches.length > 0) {
      foundInContent = true;
    }

    // Scoring
    if (foundInSchema && foundInContent) {
      analysis.answeredQuestions.push(question);
      analysis.schemaAnswers++;
      analysis.contentAnswers++;
      analysis.score += 10;
    } else if (foundInSchema || foundInContent) {
      analysis.partiallyAnswered.push(question);
      if (foundInSchema) analysis.schemaAnswers++;
      if (foundInContent) analysis.contentAnswers++;
      analysis.score += 5;

      if (foundInContent && !foundInSchema) {
        analysis.recommendations.push(
          `Add ${config.schemaPath || question} to schema - content mentions it but schema missing`
        );
      } else if (foundInSchema && !foundInContent) {
        analysis.recommendations.push(
          `Add visible content about ${question} - schema has it but page doesn't explain clearly`
        );
      }
    } else {
      analysis.missingQuestions.push(question);
      analysis.recommendations.push(
        `Add information about ${question} - common guest question not answered`
      );
    }
  });

  // Calculate final score (0-100)
  const totalQuestions = Object.keys(TYPICAL_GUEST_QUESTIONS).length;
  analysis.score = Math.round((analysis.score / (totalQuestions * 10)) * 100);

  console.log('[LLM Query Answerability] Score:', analysis.score);
  console.log('[LLM Query Answerability] Answered:', analysis.answeredQuestions.length);
  console.log('[LLM Query Answerability] Missing:', analysis.missingQuestions.length);

  return analysis;
}

module.exports = { analyzeLlmQueryAnswerability };
