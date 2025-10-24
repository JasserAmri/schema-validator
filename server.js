const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Target schemas to match
const TARGET_SCHEMAS = [
  'Hotel',
  'LodgingBusiness',
  'FAQPage',
  'Organization',
  'Review',
  'AggregateRating',
  'LocalBusiness',
  'Place',
  'Product',
  'Service',
  'JobPosting',
  'Restaurant',
  'Event',
  'BusinessEvent'
];

// Extract JSON-LD from HTML
function extractJsonLd($) {
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((i, elem) => {
    try {
      let content = $(elem).html();
      if (content) {
        // Clean the content to handle common JSON-LD issues
        content = content.trim();

        // Remove trailing commas before closing braces/brackets
        content = content.replace(/,(\s*[}\]])/g, '$1');

        // Remove any trailing commas at the end of the content
        content = content.replace(/,\s*$/, '');

        const parsed = JSON.parse(content);

        // Handle different JSON-LD structures
        if (Array.isArray(parsed)) {
          jsonLd.push(...parsed);
        } else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
          // Handle @graph structures (common in complex schemas)
          jsonLd.push(...parsed['@graph']);
        } else if (parsed['@type'] || parsed.type) {
          // Single schema object
          jsonLd.push(parsed);
        }
      }
    } catch (error) {
      console.error('Error parsing JSON-LD:', error.message);
      console.error('Attempting to fix malformed JSON...');

      try {
        let content = $(elem).html();
        if (content) {
          // More aggressive cleaning for malformed JSON-LD
          content = content.trim();

          // Remove HTML comments if any
          content = content.replace(/<!--[\s\S]*?-->/g, '');

          // Remove trailing commas more aggressively
          content = content.replace(/,(\s*[}\]])/g, '$1');
          content = content.replace(/,\s*([}\]])/g, '$1');

          // Fix common issues like missing quotes or commas
          content = content.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

          // Try to extract just the @graph part if it exists
          const graphMatch = content.match(/"@graph"\s*:\s*(\[[\s\S]*?\])/);
          if (graphMatch) {
            try {
              const graphContent = JSON.parse(graphMatch[1]);
              if (Array.isArray(graphContent)) {
                jsonLd.push(...graphContent);
                console.log('Successfully extracted @graph content after cleaning');
              }
            } catch (graphError) {
              console.error('Failed to parse @graph:', graphError.message);
            }
          }
        }
      } catch (fixError) {
        console.error('Failed to fix JSON-LD:', fixError.message);
      }
    }
  });
  return jsonLd;
}

// Extract Microdata from HTML
function extractMicrodata($) {
  const microdata = [];

  $('[itemtype]').each((i, elem) => {
    try {
      const $elem = $(elem);
      const itemtype = $elem.attr('itemtype');
      const itemid = $elem.attr('itemid') || null;

      if (itemtype && itemtype.includes('schema.org')) {
        const schemaType = itemtype.replace('https://schema.org/', '').replace('http://schema.org/', '');

        const properties = {};
        $elem.find('[itemprop]').each((j, propElem) => {
          try {
            const $propElem = $(propElem);
            const prop = $propElem.attr('itemprop');
            let value = $propElem.attr('content') || $propElem.text() || $propElem.attr('href') || $propElem.attr('src');

            // Handle nested microdata (but prevent infinite recursion)
            if ($propElem.attr('itemtype') && j < 10) { // Limit depth
              value = extractMicrodata($propElem);
            }

            if (prop && value) {
              properties[prop] = value;
            }
          } catch (propError) {
            console.error('Error extracting microdata property:', propError.message);
          }
        });

        microdata.push({
          type: schemaType,
          id: itemid,
          properties: properties
        });
      }
    } catch (error) {
      console.error('Error extracting microdata:', error.message);
    }
  });

  return microdata;
}

// Extract RDFa from HTML
function extractRdfa($) {
  const rdfa = [];

  $('[typeof]').each((i, elem) => {
    try {
      const $elem = $(elem);
      const typeOfAttr = $elem.attr('typeof');
      const about = $elem.attr('about') || null;
      const resource = $elem.attr('resource') || null;

      if (typeOfAttr && (typeOfAttr.includes('schema.org') || typeOfAttr.includes('schema:'))) {
        let schemaType = typeOfAttr.replace('schema:', '').replace('https://schema.org/', '').replace('http://schema.org/', '');

        const properties = {};
        $elem.find('[property]').each((j, propElem) => {
          try {
            const $propElem = $(propElem);
            const prop = $propElem.attr('property');
            let value = $propElem.attr('content') || $propElem.text() || $propElem.attr('href') || $propElem.attr('src');

            if (prop && value) {
              properties[prop.replace('schema:', '')] = value;
            }
          } catch (propError) {
            console.error('Error extracting RDFa property:', propError.message);
          }
        });

        rdfa.push({
          type: schemaType,
          about: about,
          resource: resource,
          properties: properties
        });
      }
    } catch (error) {
      console.error('Error extracting RDFa:', error.message);
    }
  });

  return rdfa;
}

// Schema.org validation rules with documentation links
const SCHEMA_VALIDATION_RULES = {
  'Hotel': {
    required: ['name', 'address'],
    recommended: ['telephone', 'description', 'image', 'priceRange', 'amenityFeature'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      image: { type: 'url', recommended: true, docs: 'https://schema.org/image' },
      url: { type: 'url', recommended: true, docs: 'https://schema.org/url' },
      telephone: { type: 'string', recommended: true, docs: 'https://schema.org/telephone' },
      address: { type: 'object', required: true, docs: 'https://schema.org/address' },
      priceRange: { type: 'string', recommended: true, docs: 'https://schema.org/priceRange' },
      amenityFeature: { type: 'array', recommended: true, docs: 'https://schema.org/amenityFeature' },
      checkinTime: { type: 'string', format: 'time', docs: 'https://schema.org/checkinTime' },
      checkoutTime: { type: 'string', format: 'time', docs: 'https://schema.org/checkoutTime' }
    },
    docs: 'https://schema.org/Hotel'
  },
  'LodgingBusiness': {
    required: ['name', 'address'],
    recommended: ['telephone', 'description', 'image', 'priceRange'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      image: { type: 'url', recommended: true, docs: 'https://schema.org/image' },
      url: { type: 'url', recommended: true, docs: 'https://schema.org/url' },
      telephone: { type: 'string', recommended: true, docs: 'https://schema.org/telephone' },
      address: { type: 'object', required: true, docs: 'https://schema.org/address' },
      priceRange: { type: 'string', recommended: true, docs: 'https://schema.org/priceRange' }
    },
    docs: 'https://schema.org/LodgingBusiness'
  },
  'FAQPage': {
    required: ['mainEntity'],
    recommended: ['name', 'description'],
    properties: {
      name: { type: 'string', recommended: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      mainEntity: { type: 'array', required: true, docs: 'https://schema.org/mainEntity' }
    },
    docs: 'https://schema.org/FAQPage'
  },
  'Organization': {
    required: ['name'],
    recommended: ['url', 'description', 'image', 'address', 'telephone'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      image: { type: 'url', recommended: true, docs: 'https://schema.org/image' },
      url: { type: 'url', recommended: true, docs: 'https://schema.org/url' },
      address: { type: 'object', recommended: true, docs: 'https://schema.org/address' },
      telephone: { type: 'string', recommended: true, docs: 'https://schema.org/telephone' },
      sameAs: { type: 'array', recommended: true, docs: 'https://schema.org/sameAs' }
    },
    docs: 'https://schema.org/Organization'
  },
  'Review': {
    required: ['reviewRating', 'author'],
    recommended: ['reviewBody', 'datePublished', 'itemReviewed'],
    properties: {
      reviewRating: { type: 'object', required: true, docs: 'https://schema.org/reviewRating' },
      author: { type: 'object', required: true, docs: 'https://schema.org/author' },
      reviewBody: { type: 'string', recommended: true, docs: 'https://schema.org/reviewBody' },
      datePublished: { type: 'string', format: 'date', recommended: true, docs: 'https://schema.org/datePublished' },
      itemReviewed: { type: 'object', recommended: true, docs: 'https://schema.org/itemReviewed' }
    },
    docs: 'https://schema.org/Review'
  },
  'AggregateRating': {
    required: ['ratingValue', 'reviewCount'],
    recommended: ['bestRating', 'worstRating'],
    properties: {
      ratingValue: { type: 'number', required: true, docs: 'https://schema.org/ratingValue' },
      reviewCount: { type: 'number', required: true, docs: 'https://schema.org/reviewCount' },
      bestRating: { type: 'number', recommended: true, docs: 'https://schema.org/bestRating' },
      worstRating: { type: 'number', recommended: true, docs: 'https://schema.org/worstRating' }
  },
  'LocalBusiness': {
    required: ['name', 'address'],
    recommended: ['telephone', 'description', 'image', 'url', 'priceRange', 'openingHours'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      image: { type: 'url', recommended: true, docs: 'https://schema.org/image' },
      url: { type: 'url', recommended: true, docs: 'https://schema.org/url' },
      telephone: { type: 'string', recommended: true, docs: 'https://schema.org/telephone' },
      address: { type: 'object', required: true, docs: 'https://schema.org/address' },
      priceRange: { type: 'string', recommended: true, docs: 'https://schema.org/priceRange' },
      openingHours: { type: 'string', recommended: true, docs: 'https://schema.org/openingHours' },
      geo: { type: 'object', recommended: true, docs: 'https://schema.org/geo' },
      sameAs: { type: 'array', recommended: true, docs: 'https://schema.org/sameAs' }
    },
    docs: 'https://schema.org/LocalBusiness'
  },
  'Place': {
    required: ['name'],
    recommended: ['address', 'description', 'image', 'url', 'telephone'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      image: { type: 'url', recommended: true, docs: 'https://schema.org/image' },
      url: { type: 'url', recommended: true, docs: 'https://schema.org/url' },
      telephone: { type: 'string', recommended: true, docs: 'https://schema.org/telephone' },
      address: { type: 'object', recommended: true, docs: 'https://schema.org/address' },
      geo: { type: 'object', recommended: true, docs: 'https://schema.org/geo' }
    },
    docs: 'https://schema.org/Place'
  },
  'Product': {
    required: ['name'],
    recommended: ['description', 'image', 'offers', 'category', 'brand'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      image: { type: 'url', recommended: true, docs: 'https://schema.org/image' },
      url: { type: 'url', recommended: true, docs: 'https://schema.org/url' },
      category: { type: 'string', recommended: true, docs: 'https://schema.org/category' },
      brand: { type: 'object', recommended: true, docs: 'https://schema.org/brand' },
      offers: { type: 'object', recommended: true, docs: 'https://schema.org/offers' },
      priceRange: { type: 'string', recommended: true, docs: 'https://schema.org/priceRange' }
    },
    docs: 'https://schema.org/Product'
  },
  'Service': {
    required: ['name', 'provider'],
    recommended: ['description', 'image', 'offers', 'serviceType'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      image: { type: 'url', recommended: true, docs: 'https://schema.org/image' },
      url: { type: 'url', recommended: true, docs: 'https://schema.org/url' },
      serviceType: { type: 'string', recommended: true, docs: 'https://schema.org/serviceType' },
      provider: { type: 'object', required: true, docs: 'https://schema.org/provider' },
      offers: { type: 'object', recommended: true, docs: 'https://schema.org/offers' },
      areaServed: { type: 'object', recommended: true, docs: 'https://schema.org/areaServed' }
    },
    docs: 'https://schema.org/Service'
  },
  'JobPosting': {
    required: ['title', 'hiringOrganization'],
    recommended: ['description', 'datePosted', 'employmentType', 'jobLocation'],
    properties: {
      title: { type: 'string', required: true, docs: 'https://schema.org/title' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      datePosted: { type: 'string', format: 'date', recommended: true, docs: 'https://schema.org/datePosted' },
      employmentType: { type: 'string', recommended: true, docs: 'https://schema.org/employmentType' },
      hiringOrganization: { type: 'object', required: true, docs: 'https://schema.org/hiringOrganization' },
      jobLocation: { type: 'object', recommended: true, docs: 'https://schema.org/jobLocation' },
      salaryCurrency: { type: 'string', recommended: true, docs: 'https://schema.org/salaryCurrency' }
    },
    docs: 'https://schema.org/JobPosting'
  },
  'Restaurant': {
    required: ['name', 'address'],
    recommended: ['telephone', 'description', 'image', 'priceRange', 'servesCuisine', 'menu'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      image: { type: 'url', recommended: true, docs: 'https://schema.org/image' },
      url: { type: 'url', recommended: true, docs: 'https://schema.org/url' },
      telephone: { type: 'string', recommended: true, docs: 'https://schema.org/telephone' },
      address: { type: 'object', required: true, docs: 'https://schema.org/address' },
      priceRange: { type: 'string', recommended: true, docs: 'https://schema.org/priceRange' },
      servesCuisine: { type: 'string', recommended: true, docs: 'https://schema.org/servesCuisine' },
      menu: { type: 'url', recommended: true, docs: 'https://schema.org/menu' },
      acceptsReservations: { type: 'boolean', recommended: true, docs: 'https://schema.org/acceptsReservations' }
    },
    docs: 'https://schema.org/Restaurant'
  },
  'Event': {
    required: ['name', 'startDate'],
    recommended: ['description', 'endDate', 'location', 'offers', 'image'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      startDate: { type: 'string', format: 'date', required: true, docs: 'https://schema.org/startDate' },
      endDate: { type: 'string', format: 'date', recommended: true, docs: 'https://schema.org/endDate' },
      location: { type: 'object', recommended: true, docs: 'https://schema.org/location' },
      image: { type: 'url', recommended: true, docs: 'https://schema.org/image' },
      url: { type: 'url', recommended: true, docs: 'https://schema.org/url' },
      offers: { type: 'object', recommended: true, docs: 'https://schema.org/offers' },
      eventStatus: { type: 'string', recommended: true, docs: 'https://schema.org/eventStatus' }
    },
    docs: 'https://schema.org/Event'
  },
  'BusinessEvent': {
    required: ['name', 'startDate'],
    recommended: ['description', 'endDate', 'location', 'organizer'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', recommended: true, docs: 'https://schema.org/description' },
      startDate: { type: 'string', format: 'date', required: true, docs: 'https://schema.org/startDate' },
      endDate: { type: 'string', format: 'date', recommended: true, docs: 'https://schema.org/endDate' },
      location: { type: 'object', recommended: true, docs: 'https://schema.org/location' },
      organizer: { type: 'object', recommended: true, docs: 'https://schema.org/organizer' },
      image: { type: 'url', recommended: true, docs: 'https://schema.org/image' }
    },
    docs: 'https://schema.org/BusinessEvent'
  }

// Validate a single schema object
function validateSchema(schema, schemaType) {
  const validation = {
    isValid: true,
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    schemaDocs: ''
  };

  const rules = SCHEMA_VALIDATION_RULES[schemaType];
  if (!rules) {
    validation.issues.push(`Unknown schema type: ${schemaType}`);
    validation.isValid = false;
    return validation;
  }

  validation.schemaDocs = rules.docs || '';

  let requiredScore = 0;
  let recommendedScore = 0;

  // Check required properties
  rules.required.forEach(prop => {
    if (!schema[prop] && !schema['@' + prop]) {
      const propDocs = rules.properties[prop]?.docs || rules.docs;
      validation.issues.push({
        message: `Missing required property: ${prop}`,
        docs: propDocs,
        property: prop,
        type: 'required'
      });
      validation.isValid = false;
    } else {
      requiredScore += 25; // 25 points per required property
    }
  });

  // Check recommended properties
  rules.recommended.forEach(prop => {
    if (!schema[prop] && !schema['@' + prop]) {
      const propDocs = rules.properties[prop]?.docs || rules.docs;
      validation.recommendations.push({
        message: `Consider adding recommended property: ${prop}`,
        docs: propDocs,
        property: prop,
        type: 'recommended'
      });
    } else {
      recommendedScore += 15; // 15 points per recommended property
    }
  });

  // Validate property data types and formats
  Object.entries(rules.properties).forEach(([prop, rule]) => {
    const value = schema[prop] || schema['@' + prop];
    if (value) {
      // Type validation
      if (rule.type === 'url' && !isValidUrl(value)) {
        validation.issues.push({
          message: `Invalid URL format for property: ${prop}`,
          docs: rule.docs,
          property: prop,
          type: 'format'
        });
      } else if (rule.type === 'number' && isNaN(Number(value))) {
        validation.issues.push({
          message: `Invalid number format for property: ${prop}`,
          docs: rule.docs,
          property: prop,
          type: 'format'
        });
      } else if (rule.format === 'date' && !isValidDate(value)) {
        validation.issues.push({
          message: `Invalid date format for property: ${prop}`,
          docs: rule.docs,
          property: prop,
          type: 'format'
        });
      } else if (rule.format === 'time' && !isValidTime(value)) {
        validation.issues.push({
          message: `Invalid time format for property: ${prop}`,
          docs: rule.docs,
          property: prop,
          type: 'format'
        });
      }
    }
  });

  // Calculate score
  validation.score = requiredScore + recommendedScore;
  validation.maxScore = (rules.required.length * 25) + (rules.recommended.length * 15);

  return validation;
}

// Validate URL format
function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Validate time format (HH:MM or ISO time)
function isValidTime(value) {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(value) || /^\d{2}:\d{2}:\d{2}$/.test(value);
}

// Check if schema matches target schemas
function matchesTargetSchemas(schemaType) {
  return TARGET_SCHEMAS.some(target => {
    return schemaType.toLowerCase().includes(target.toLowerCase()) ||
           target.toLowerCase().includes(schemaType.toLowerCase());
  });
}

// Analyze robots.txt file
async function analyzeRobotsTxt(url) {
  const analysis = {
    exists: false,
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    aiCrawlers: [],
    sitemapFound: false,
    sitemapUrl: null,
    userAgents: []
  };

  try {
    const robotsUrl = new URL('/robots.txt', url).href;
    const response = await axios.get(robotsUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    analysis.exists = true;
    analysis.content = response.data;
    analysis.lastModified = response.headers['last-modified'] || null;

    // Parse robots.txt content
    const lines = response.data.split('\n');
    let currentUserAgent = null;

    lines.forEach(line => {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) return;

      // User-agent declaration
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        currentUserAgent = trimmed.substring(11).trim().toLowerCase();
        analysis.userAgents.push(currentUserAgent);
      }

      // AI crawler detection
      if (currentUserAgent) {
        if (currentUserAgent.includes('gptbot') || currentUserAgent.includes('chatgpt')) {
          analysis.aiCrawlers.push('GPTBot');
        } else if (currentUserAgent.includes('claude')) {
          analysis.aiCrawlers.push('ClaudeBot');
        } else if (currentUserAgent.includes('perplexity')) {
          analysis.aiCrawlers.push('PerplexityBot');
        }
      }

      // Sitemap declaration
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        analysis.sitemapFound = true;
        analysis.sitemapUrl = trimmed.substring(8).trim();
      }
    });

    // Remove duplicates from AI crawlers
    analysis.aiCrawlers = [...new Set(analysis.aiCrawlers)];

    // Scoring logic
    if (analysis.exists) analysis.score += 30;

    if (analysis.aiCrawlers.length > 0) {
      analysis.score += 25; // AI crawler management
    } else {
      analysis.recommendations.push('Consider adding AI crawler permissions (GPTBot, ClaudeBot, etc.)');
    }

    if (analysis.sitemapFound) {
      analysis.score += 20;
    } else {
      analysis.issues.push('Missing sitemap declaration in robots.txt');
    }

    if (analysis.userAgents.length > 1) {
      analysis.score += 15; // Multiple user-agent support
    }

    // Check for common issues
    if (response.data.toLowerCase().includes('disallow: /')) {
      analysis.recommendations.push('Consider allowing some content for better AI and search engine access');
    }

    if (!response.data.toLowerCase().includes('crawl-delay')) {
      analysis.recommendations.push('Consider adding crawl-delay for better server performance');
    }

  } catch (error) {
    analysis.issues.push('robots.txt file not accessible or not found');
    if (error.response && error.response.status === 404) {
      analysis.recommendations.push('Create a robots.txt file at your website root');
    }
  }

  return analysis;
}

// Analyze LLM.txt file
async function analyzeLlmTxt(url) {
  const analysis = {
    exists: false,
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    sections: [],
    aiGuidelines: [],
    businessInfo: null,
    contentQuality: 'none'
  };

  try {
    const llmUrl = new URL('/llms.txt', url).href;
    const response = await axios.get(llmUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    analysis.exists = true;
    analysis.content = response.data;
    analysis.lastModified = response.headers['last-modified'] || null;

    const content = response.data;
    const lines = content.split('\n');

    // Analyze content structure
    let currentSection = null;
    let hasBusinessInfo = false;
    let hasGuidelines = false;
    let hasContact = false;

    lines.forEach(line => {
      const trimmed = line.trim();

      // Section headers
      if (trimmed.startsWith('# ')) {
        currentSection = trimmed.substring(2).trim();
        analysis.sections.push(currentSection);
        if (currentSection.toLowerCase().includes('about') || currentSection.toLowerCase().includes('business')) {
          hasBusinessInfo = true;
        }
      }

      // AI guidelines
      if (trimmed.toLowerCase().includes('guidelines for ai') || trimmed.toLowerCase().includes('ai systems')) {
        hasGuidelines = true;
      }

      // Contact information
      if (trimmed.toLowerCase().includes('contact') || trimmed.toLowerCase().includes('email') || trimmed.toLowerCase().includes('phone')) {
        hasContact = true;
      }
    });

    analysis.businessInfo = hasBusinessInfo;
    analysis.aiGuidelines = hasGuidelines ? ['AI usage guidelines provided'] : [];
    analysis.hasContact = hasContact;

    // Content quality assessment
    if (content.length > 500) {
      analysis.contentQuality = 'comprehensive';
      analysis.score += 40;
    } else if (content.length > 200) {
      analysis.contentQuality = 'good';
      analysis.score += 25;
    } else if (content.length > 50) {
      analysis.contentQuality = 'basic';
      analysis.score += 10;
    }

    // Structure scoring
    if (analysis.sections.length > 0) {
      analysis.score += 20; // Well-structured content
    } else {
      analysis.issues.push('Consider adding section headers for better organization');
    }

    if (hasBusinessInfo) {
      analysis.score += 20;
    } else {
      analysis.recommendations.push('Add business description and overview section');
    }

    if (hasGuidelines) {
      analysis.score += 15;
    } else {
      analysis.recommendations.push('Add AI usage guidelines section');
    }

    if (hasContact) {
      analysis.score += 5;
    } else {
      analysis.recommendations.push('Consider adding contact information for AI systems');
    }

    // Check for markdown formatting
    if (content.includes('#') || content.includes('**') || content.includes('*') || content.includes('-')) {
      analysis.score += 10; // Proper markdown formatting
    } else {
      analysis.recommendations.push('Use markdown formatting for better readability');
    }

  } catch (error) {
    analysis.issues.push('llms.txt file not accessible or not found');
    if (error.response && error.response.status === 404) {
      analysis.recommendations.push('Create an llms.txt file to improve AI search visibility');
      analysis.recommendations.push('Include business description, services, and AI guidelines');
    }
  }

  return analysis;
}

// Analyze OpenGraph meta tags
async function analyzeOpenGraph(url) {
  const analysis = {
    exists: false,
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    tags: {},
    hotelSpecific: {},
    socialCoverage: []
  };

  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    analysis.exists = true;
    analysis.content = response.data;
    analysis.lastModified = response.headers['last-modified'] || null;

    const $ = cheerio.load(response.data);

    // Extract OpenGraph meta tags
    const ogTags = {};
    $('meta[property^="og:"]').each((i, elem) => {
      const property = $(elem).attr('property');
      const content = $(elem).attr('content');
      if (property && content) {
        ogTags[property] = content;
      }
    });

    // Extract Twitter Card tags
    const twitterTags = {};
    $('meta[name^="twitter:"]').each((i, elem) => {
      const name = $(elem).attr('name');
      const content = $(elem).attr('content');
      if (name && content) {
        twitterTags[name] = content;
      }
    });

    analysis.tags = ogTags;
    analysis.twitterTags = twitterTags;

    // Check for social platform coverage
    if (Object.keys(ogTags).length > 0) analysis.socialCoverage.push('Facebook');
    if (Object.keys(twitterTags).length > 0) analysis.socialCoverage.push('Twitter');

    // Basic OpenGraph scoring
    const requiredOg = ['og:title', 'og:description', 'og:image', 'og:url'];
    let requiredCount = 0;

    requiredOg.forEach(prop => {
      if (ogTags[prop]) {
        requiredCount++;
        analysis.score += 15; // 15 points per required property
      } else {
        analysis.issues.push(`Missing OpenGraph property: ${prop}`);
      }
    });

    // Check content quality
    if (ogTags['og:title'] && ogTags['og:title'].length > 10) {
      analysis.score += 10; // Good title length
    } else if (ogTags['og:title']) {
      analysis.recommendations.push('Consider longer, more descriptive OpenGraph title');
    }

    if (ogTags['og:description'] && ogTags['og:description'].length > 50) {
      analysis.score += 10; // Good description length
    } else if (ogTags['og:description']) {
      analysis.recommendations.push('Consider longer OpenGraph description (50+ characters)');
    }

    // Check image optimization
    if (ogTags['og:image']) {
      analysis.score += 10;
      if (ogTags['og:image:width'] && ogTags['og:image:height']) {
        analysis.score += 5; // Image dimensions specified
      } else {
        analysis.recommendations.push('Add og:image:width and og:image:height for better display');
      }
    }

    // Hotel-specific properties
    const hotelProps = ['hotel:amenity', 'hotel:checkin_time', 'hotel:checkout_time', 'hotel:price_range'];
    hotelProps.forEach(prop => {
      if (ogTags[prop]) {
        analysis.hotelSpecific[prop] = ogTags[prop];
        analysis.score += 5; // 5 points per hotel-specific property
      }
    });

    // Twitter Cards analysis
    if (twitterTags['twitter:card']) {
      analysis.score += 10;
      analysis.socialCoverage.push('Twitter');

      if (twitterTags['twitter:image'] && twitterTags['twitter:image'] !== ogTags['og:image']) {
        analysis.score += 5; // Different images for different platforms
      }
    }

    // Check for og:type
    if (ogTags['og:type']) {
      analysis.score += 5;
      if (ogTags['og:type'] === 'hotel') {
        analysis.score += 5; // Proper hotel type
      }
    } else {
      analysis.issues.push('Missing og:type property');
    }

  } catch (error) {
    analysis.issues.push('Unable to access website for OpenGraph analysis');
    analysis.recommendations.push('Ensure website is accessible and not blocking requests');
  }

  return analysis;
}

// Analyze AI.txt file
async function analyzeAiTxt(url) {
  const analysis = {
    exists: false,
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    aiCrawlers: [],
    usageGuidelines: [],
    attributionRequired: false,
    lastModified: null
  };

  try {
    const aiUrl = new URL('/ai.txt', url).href;
    const response = await axios.get(aiUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    analysis.exists = true;
    analysis.content = response.data;
    analysis.lastModified = response.headers['last-modified'] || null;

    const content = response.data;
    const lines = content.split('\n');

    // Analyze AI.txt content
    let hasPermissions = false;
    let hasGuidelines = false;
    let hasAttribution = false;

    lines.forEach(line => {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) return;

      // AI crawler permissions
      if (trimmed.toLowerCase().includes('user-agent:')) {
        const userAgent = trimmed.substring(11).trim().toLowerCase();
        if (userAgent.includes('gptbot') || userAgent.includes('claude') || userAgent.includes('perplexity')) {
          analysis.aiCrawlers.push(userAgent);
          hasPermissions = true;
        }
      }

      // Usage guidelines
      if (trimmed.toLowerCase().includes('guidelines') || trimmed.toLowerCase().includes('usage')) {
        hasGuidelines = true;
        analysis.usageGuidelines.push(trimmed);
      }

      // Attribution requirements
      if (trimmed.toLowerCase().includes('attribution') || trimmed.toLowerCase().includes('citation') || trimmed.toLowerCase().includes('credit')) {
        hasAttribution = true;
        analysis.attributionRequired = true;
      }
    });

    // Remove duplicates
    analysis.aiCrawlers = [...new Set(analysis.aiCrawlers)];

    // Scoring logic
    if (analysis.exists) analysis.score += 30;

    if (hasPermissions) {
      analysis.score += 25; // AI crawler permissions
    } else {
      analysis.recommendations.push('Consider adding AI crawler permissions (GPTBot, ClaudeBot, etc.)');
    }

    if (hasGuidelines) {
      analysis.score += 20;
    } else {
      analysis.issues.push('Missing AI usage guidelines');
    }

    if (hasAttribution) {
      analysis.score += 15;
    } else {
      analysis.recommendations.push('Consider adding attribution requirements for content usage');
    }

    if (analysis.aiCrawlers.length > 0) {
      analysis.score += 10; // Multiple AI crawler support
    }

  } catch (error) {
    analysis.issues.push('ai.txt file not accessible or not found');
    if (error.response && error.response.status === 404) {
      analysis.recommendations.push('Create an ai.txt file to control AI crawler access');
      analysis.recommendations.push('Include AI bot permissions and usage guidelines');
    }
  }

  return analysis;
}

// Analyze sitemap.xml file
async function analyzeSitemap(url) {
  const analysis = {
    exists: false,
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    urlCount: 0,
    lastModified: null,
    priorities: [],
    changeFreqs: [],
    hasImages: false,
    xmlValid: false
  };

  try {
    const sitemapUrl = new URL('/sitemap.xml', url).href;
    const response = await axios.get(sitemapUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    analysis.exists = true;
    analysis.content = response.data;
    analysis.lastModified = response.headers['last-modified'] || null;

    const $ = cheerio.load(response.data, { xmlMode: true });

    // Check XML validity
    if ($('urlset').length > 0 || $('sitemapindex').length > 0) {
      analysis.xmlValid = true;
      analysis.score += 20;
    } else {
      analysis.issues.push('Invalid XML structure - missing urlset or sitemapindex');
      analysis.xmlValid = false;
    }

    // Analyze URLs
    const urls = $('url');
    analysis.urlCount = urls.length;

    if (urls.length > 0) {
      analysis.score += 25; // Has URLs

      urls.each((i, elem) => {
        const $elem = $(elem);
        const loc = $elem.find('loc').text();
        const priority = $elem.find('priority').text();
        const changefreq = $elem.find('changefreq').text();
        const lastmod = $elem.find('lastmod').text();

        // Check for homepage
        if (loc === url + '/' || loc === url) {
          if (priority === '1.0') {
            analysis.score += 5; // Homepage properly prioritized
          }
        }

        if (priority) {
          analysis.priorities.push(priority);
        }

        if (changefreq) {
          analysis.changeFreqs.push(changefreq);
        }

        // Check for lastmod dates
        if (lastmod && /^\d{4}-\d{2}-\d{2}/.test(lastmod)) {
          analysis.score += 2; // Proper date format (max 5 points)
        }
      });

      // Check image sitemaps
      if ($('image\\:image').length > 0 || $('image').length > 0) {
        analysis.hasImages = true;
        analysis.score += 10;
      }

      // Check for proper priority distribution
      const priorities = analysis.priorities.map(p => parseFloat(p)).filter(p => !isNaN(p));
      if (priorities.length > 0) {
        const maxPriority = Math.max(...priorities);
        const minPriority = Math.min(...priorities);
        if (maxPriority === 1.0 && minPriority >= 0.1) {
          analysis.score += 10; // Good priority range
        }
      }

      // Check change frequency variety
      if (analysis.changeFreqs.length > 2) {
        analysis.score += 5; // Multiple change frequencies used
      }

    } else {
      analysis.issues.push('No URLs found in sitemap');
    }

    // Check for sitemap index
    const sitemapIndex = $('sitemapindex');
    if (sitemapIndex.length > 0) {
      analysis.score += 15; // Sitemap index for large sites
      analysis.urlCount = sitemapIndex.find('sitemap').length;
    }

    // Recommendations
    if (urls.length < 10) {
      analysis.recommendations.push('Consider adding more URLs to sitemap for better indexing');
    }

    if (analysis.priorities.length === 0) {
      analysis.recommendations.push('Add priority values to help search engines understand page importance');
    }

    if (analysis.changeFreqs.length === 0) {
      analysis.recommendations.push('Add changefreq values to indicate content update frequency');
    }

    if (!analysis.hasImages) {
      analysis.recommendations.push('Consider adding image sitemap for better image indexing');
    }

  } catch (error) {
    analysis.issues.push('sitemap.xml file not accessible or not found');
    if (error.response && error.response.status === 404) {
      analysis.recommendations.push('Create a sitemap.xml file at your website root');
      analysis.recommendations.push('Include all important pages with proper priorities');
    }
  }

  return analysis;
}

// Analyze enhanced FAQ/HowTo schema for AEO optimization
function analyzeFaqHowToSchema(jsonLd, microdata, rdfa) {
  const analysis = {
    exists: false,
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    faqQuality: 0,
    howToQuality: 0,
    totalQuestions: 0,
    totalSteps: 0,
    featuredSnippetPotential: 'low'
  };

  // Find FAQ and HowTo schemas
  const faqSchemas = [];
  const howToSchemas = [];

  // Check JSON-LD
  jsonLd.forEach((schema, index) => {
    const schemaType = schema['@type'] || schema.type;
    if (schemaType === 'FAQPage') {
      faqSchemas.push({ schema, index, type: 'JSON-LD' });
    } else if (schemaType === 'HowTo') {
      howToSchemas.push({ schema, index, type: 'JSON-LD' });
    }
  });

  // Check Microdata
  microdata.forEach((schema, index) => {
    if (schema.type === 'FAQPage') {
      faqSchemas.push({ schema, index, type: 'Microdata' });
    } else if (schema.type === 'HowTo') {
      howToSchemas.push({ schema, index, type: 'Microdata' });
    }
  });

  // Check RDFa
  rdfa.forEach((schema, index) => {
    if (schema.type === 'FAQPage') {
      faqSchemas.push({ schema, index, type: 'RDFa' });
    } else if (schema.type === 'HowTo') {
      howToSchemas.push({ schema, index, type: 'RDFa' });
    }
  });

  analysis.exists = faqSchemas.length > 0 || howToSchemas.length > 0;

  if (!analysis.exists) {
    analysis.issues.push('No FAQ or HowTo schema found');
    analysis.recommendations.push('Add FAQPage schema for common hotel questions');
    analysis.recommendations.push('Consider HowTo schema for booking processes or amenities');
    return analysis;
  }

  // Analyze FAQ schemas
  faqSchemas.forEach(faq => {
    const schema = faq.schema;
    const mainEntity = schema.mainEntity || schema.properties?.mainEntity;

    if (mainEntity && Array.isArray(mainEntity)) {
      analysis.totalQuestions += mainEntity.length;

      mainEntity.forEach(question => {
        // Check question quality
        if (question.name && question.name.length > 20) {
          analysis.faqQuality += 10; // Good question length
        } else if (question.name) {
          analysis.recommendations.push('Use more descriptive question text (20+ characters)');
        }

        // Check answer quality
        if (question.acceptedAnswer && question.acceptedAnswer.text) {
          const answerText = question.acceptedAnswer.text;
          if (answerText.length > 100) {
            analysis.faqQuality += 15; // Comprehensive answer
          } else if (answerText.length > 50) {
            analysis.faqQuality += 10; // Good answer length
          } else {
            analysis.recommendations.push('Provide more detailed answers (50+ characters)');
          }
        } else {
          analysis.issues.push('Missing answer text in FAQ');
        }
      });
    }
  });

  // Analyze HowTo schemas
  howToSchemas.forEach(howTo => {
    const schema = howTo.schema;
    const steps = schema.step || schema.properties?.step;

    if (steps && Array.isArray(steps)) {
      analysis.totalSteps += steps.length;

      steps.forEach((step, index) => {
        // Check step completeness
        if (step.text || step.description) {
          analysis.howToQuality += 10; // Step has content

          if ((step.text || step.description).length > 30) {
            analysis.howToQuality += 5; // Detailed step
          }
        } else {
          analysis.issues.push(`HowTo step ${index + 1} missing content`);
        }

        // Check for required HowTo properties
        if (schema.name && schema.description) {
          analysis.howToQuality += 10; // Proper HowTo structure
        }
      });
    }
  });

  // Calculate overall score
  const totalItems = analysis.totalQuestions + analysis.totalSteps;
  if (totalItems > 0) {
    analysis.score += 30; // Has FAQ/HowTo content

    if (analysis.faqQuality > 50 || analysis.howToQuality > 50) {
      analysis.score += 25; // Good quality content
    }

    if (totalItems > 5) {
      analysis.score += 20; // Comprehensive coverage
    } else if (totalItems > 2) {
      analysis.score += 10; // Basic coverage
    }

    if (analysis.totalQuestions > 0) {
      analysis.score += 15; // FAQ content
    }

    if (analysis.totalSteps > 0) {
      analysis.score += 10; // HowTo content
    }
  }

  // Featured snippet potential
  if (analysis.faqQuality > 70 && analysis.totalQuestions > 3) {
    analysis.featuredSnippetPotential = 'high';
    analysis.score += 15;
  } else if (analysis.faqQuality > 40 && analysis.totalQuestions > 1) {
    analysis.featuredSnippetPotential = 'medium';
    analysis.score += 5;
  }

  // Recommendations
  if (analysis.totalQuestions < 3) {
    analysis.recommendations.push('Add more FAQ questions (aim for 3-5+ for better AEO)');
  }

  if (analysis.totalSteps === 0) {
    analysis.recommendations.push('Consider HowTo schema for booking processes or amenities');
  }

  if (analysis.featuredSnippetPotential === 'low') {
    analysis.recommendations.push('Improve question clarity and answer detail for featured snippet potential');
  }

  return analysis;
}

// Analyze breadcrumb navigation
function analyzeBreadcrumbs($) {
  const analysis = {
    exists: false,
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    breadcrumbType: null,
    depth: 0,
    structured: false,
    accurate: false
  };

  // Check for JSON-LD breadcrumbs
  let jsonLdBreadcrumbs = null;
  $('script[type="application/ld+json"]').each((i, elem) => {
    try {
      const content = $(elem).html();
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed['@type'] === 'BreadcrumbList') {
          jsonLdBreadcrumbs = parsed;
          analysis.exists = true;
          analysis.breadcrumbType = 'JSON-LD';
          analysis.structured = true;
        }
      }
    } catch (error) {
      // Invalid JSON, continue
    }
  });

  // Check for Microdata breadcrumbs
  const breadcrumbElements = $('[itemtype*="BreadcrumbList"], [itemtype*="breadcrumb"]');
  if (breadcrumbElements.length > 0) {
    analysis.exists = true;
    analysis.breadcrumbType = 'Microdata';
    analysis.structured = true;
  }

  // Check for simple HTML breadcrumbs (nav with aria-label)
  const navBreadcrumbs = $('nav[aria-label*="breadcrumb"], .breadcrumb, [class*="breadcrumb"]');
  if (navBreadcrumbs.length > 0 && !analysis.exists) {
    analysis.exists = true;
    analysis.breadcrumbType = 'HTML';
  }

  if (!analysis.exists) {
    analysis.issues.push('No breadcrumb navigation found');
    analysis.recommendations.push('Add breadcrumb navigation for better site structure');
    analysis.recommendations.push('Use JSON-LD BreadcrumbList for best SEO results');
    return analysis;
  }

  // Analyze JSON-LD breadcrumbs
  if (jsonLdBreadcrumbs) {
    const items = jsonLdBreadcrumbs.itemListElement || [];
    analysis.depth = items.length;

    if (items.length > 0) {
      analysis.score += 40; // Has breadcrumb structure

      // Check first item (should be homepage)
      if (items[0] && items[0].item && items[0].item['@id'] === jsonLdBreadcrumbs.url || items[0].item.name === 'Home') {
        analysis.score += 10; // Proper homepage reference
      }

      // Check completeness
      if (items.length >= 3) {
        analysis.score += 15; // Good depth
      } else {
        analysis.recommendations.push('Consider adding more breadcrumb levels (3+ for better structure)');
      }

      // Check for proper structure
      items.forEach((item, index) => {
        if (item.position === index + 1 && item.name && item.item) {
          analysis.score += 5; // Proper position and required properties
        } else {
          analysis.issues.push(`Breadcrumb item ${index + 1} missing required properties`);
        }
      });
    }
  }

  // Analyze Microdata breadcrumbs
  if (analysis.breadcrumbType === 'Microdata') {
    breadcrumbElements.each((i, elem) => {
      const $elem = $(elem);
      const items = $elem.find('[itemprop="itemListElement"]');

      if (items.length > 0) {
        analysis.depth = items.length;
        analysis.score += 35; // Has microdata structure

        if (items.length >= 3) {
          analysis.score += 10; // Good depth
        }
      }
    });
  }

  // Check accuracy vs actual site structure
  const currentPath = $('meta[property="og:url"]').attr('content') || url;
  if (currentPath && jsonLdBreadcrumbs) {
    // This would need more complex path analysis in a real implementation
    analysis.accurate = true;
    analysis.score += 10;
  }

  // Recommendations
  if (analysis.depth < 2) {
    analysis.recommendations.push('Add more breadcrumb levels for better navigation');
  }

  if (!analysis.structured) {
    analysis.recommendations.push('Use structured markup (JSON-LD or Microdata) instead of plain HTML');
  }

  if (!analysis.accurate) {
    analysis.recommendations.push('Ensure breadcrumbs accurately reflect site structure');
  }

  return analysis;
}

// Analyze content structure for AI-friendliness
function analyzeContentStructure($) {
  const analysis = {
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    headerHierarchy: {},
    paragraphStats: {},
    contentDensity: 'unknown',
    readabilityScore: 0
  };

  // Analyze header hierarchy (H1-H6)
  const headers = {};
  for (let i = 1; i <= 6; i++) {
    const hElements = $(`h${i}`);
    headers[`h${i}`] = hElements.length;

    if (hElements.length > 0) {
      analysis.score += 5; // Has headers
    }
  }

  analysis.headerHierarchy = headers;

  // Check for proper H1 usage
  if (headers.h1 === 1) {
    analysis.score += 15; // Single H1 (SEO best practice)
  } else if (headers.h1 === 0) {
    analysis.issues.push('Missing H1 tag - add a main page heading');
  } else if (headers.h1 > 1) {
    analysis.issues.push('Multiple H1 tags - use only one H1 per page');
  }

  // Check header hierarchy (H2 should follow H1, etc.)
  let hierarchyScore = 0;
  if (headers.h1 > 0 && headers.h2 > 0) hierarchyScore += 10;
  if (headers.h2 > 0 && headers.h3 > 0) hierarchyScore += 5;
  analysis.score += hierarchyScore;

  // Analyze paragraph structure
  const paragraphs = $('p');
  const paragraphLengths = [];

  paragraphs.each((i, elem) => {
    const text = $(elem).text().trim();
    if (text.length > 0) {
      paragraphLengths.push(text.length);
    }
  });

  analysis.paragraphStats = {
    count: paragraphs.length,
    averageLength: paragraphLengths.length > 0 ? Math.round(paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length) : 0,
    minLength: paragraphLengths.length > 0 ? Math.min(...paragraphLengths) : 0,
    maxLength: paragraphLengths.length > 0 ? Math.max(...paragraphLengths) : 0
  };

  // Paragraph quality scoring
  if (paragraphs.length > 0) {
    analysis.score += 10; // Has paragraphs

    const avgLength = analysis.paragraphStats.averageLength;
    if (avgLength > 100) {
      analysis.score += 10; // Good paragraph length for readability
    } else if (avgLength < 50) {
      analysis.recommendations.push('Consider longer paragraphs (100+ characters) for better content depth');
    }
  }

  // Check for lists (good for AI understanding)
  const lists = $('ul, ol');
  if (lists.length > 0) {
    analysis.score += 10; // Has structured lists

    lists.each((i, elem) => {
      const items = $(elem).find('li');
      if (items.length > 2) {
        analysis.score += 5; // Meaningful list with multiple items
      }
    });
  } else {
    analysis.recommendations.push('Add bullet points or numbered lists for better content structure');
  }

  // Check for content density (not too dense, not too sparse)
  const contentText = $('body').text().trim();
  const contentLength = contentText.length;

  if (contentLength > 1000) {
    analysis.contentDensity = 'comprehensive';
    analysis.score += 15;
  } else if (contentLength > 500) {
    analysis.contentDensity = 'good';
    analysis.score += 10;
  } else if (contentLength > 200) {
    analysis.contentDensity = 'basic';
    analysis.score += 5;
  } else {
    analysis.issues.push('Very short content - consider adding more detailed information');
  }

  // Readability analysis
  if (paragraphLengths.length > 0) {
    const avgLength = analysis.paragraphStats.averageLength;
    if (avgLength > 80 && avgLength < 150) {
      analysis.readabilityScore = 85; // Optimal readability
      analysis.score += 10;
    } else if (avgLength > 50 && avgLength < 200) {
      analysis.readabilityScore = 70; // Good readability
      analysis.score += 5;
    }
  }

  // Recommendations based on findings
  if (Object.values(headers).filter(h => h > 0).length < 2) {
    analysis.recommendations.push('Use multiple header levels (H1, H2, H3) for better content structure');
  }

  if (paragraphs.length < 3) {
    analysis.recommendations.push('Add more paragraph content for better information depth');
  }

  if (lists.length === 0) {
    analysis.recommendations.push('Include lists or bullet points for better content organization');
  }

  return analysis;
}

// Analyze Core Web Vitals and page speed (simulated based on HTML structure)
function analyzePerformance($, html, url) {
  const analysis = {
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    coreWebVitals: {
      LCP: { value: '0s', score: 0, status: 'unknown' },
      FID: { value: '0ms', score: 0, status: 'unknown' },
      CLS: { value: '0', score: 0, status: 'unknown' }
    },
    pageSpeed: {
      loadTime: 'unknown',
      size: 'unknown',
      requests: 0,
      score: 0
    },
    mobileFriendly: false,
    technicalSEO: {
      brokenLinks: 0,
      redirects: 0,
      statusCodes: {},
      score: 0,
      canonicalFound: false,
      internalLinks: 0
    }
  };

  // Analyze HTML size and complexity
  const htmlSize = html.length;
  analysis.pageSpeed.size = `${Math.round(htmlSize / 1024)}KB`;

  // Count external resources (images, scripts, stylesheets)
  const images = $('img').length;
  const scripts = $('script').length;
  const stylesheets = $('link[rel="stylesheet"]').length;
  const totalResources = images + scripts + stylesheets;
  analysis.pageSpeed.requests = totalResources;

  // Page speed scoring based on resource count and HTML size
  if (htmlSize < 50000) { // < 50KB
    analysis.pageSpeed.score += 25;
    analysis.pageSpeed.loadTime = '< 1s';
  } else if (htmlSize < 100000) { // < 100KB
    analysis.pageSpeed.score += 15;
    analysis.pageSpeed.loadTime = '1-2s';
  } else if (htmlSize < 200000) { // < 200KB
    analysis.pageSpeed.score += 10;
    analysis.pageSpeed.loadTime = '2-3s';
  } else {
    analysis.pageSpeed.loadTime = '> 3s';
    analysis.issues.push('Large HTML size - consider reducing content or using compression');
  }

  // Resource optimization scoring
  if (totalResources < 20) {
    analysis.pageSpeed.score += 25; // Optimized resource count
  } else if (totalResources < 50) {
    analysis.pageSpeed.score += 15; // Good resource count
  } else if (totalResources < 100) {
    analysis.pageSpeed.score += 5; // Acceptable resource count
  } else {
    analysis.issues.push('Too many resources - consider combining files or lazy loading');
  }

  // Core Web Vitals estimation based on HTML structure
  // LCP (Largest Contentful Paint) - estimate based on image count and size
  if (images === 0) {
    analysis.coreWebVitals.LCP.value = '1.2s';
    analysis.coreWebVitals.LCP.score = 90;
    analysis.coreWebVitals.LCP.status = 'good';
    analysis.score += 15;
  } else if (images <= 5) {
    analysis.coreWebVitals.LCP.value = '2.1s';
    analysis.coreWebVitals.LCP.score = 75;
    analysis.coreWebVitals.LCP.status = 'needs-improvement';
    analysis.score += 10;
  } else {
    analysis.coreWebVitals.LCP.value = '3.8s';
    analysis.coreWebVitals.LCP.score = 40;
    analysis.coreWebVitals.LCP.status = 'poor';
    analysis.issues.push('Multiple images may impact LCP - consider image optimization');
  }

  // FID (First Input Delay) - estimate based on JavaScript
  if (scripts <= 3) {
    analysis.coreWebVitals.FID.value = '45ms';
    analysis.coreWebVitals.FID.score = 95;
    analysis.coreWebVitals.FID.status = 'good';
    analysis.score += 15;
  } else if (scripts <= 8) {
    analysis.coreWebVitals.FID.value = '120ms';
    analysis.coreWebVitals.FID.score = 65;
    analysis.coreWebVitals.FID.status = 'needs-improvement';
    analysis.score += 8;
  } else {
    analysis.coreWebVitals.FID.value = '280ms';
    analysis.coreWebVitals.FID.score = 30;
    analysis.coreWebVitals.FID.status = 'poor';
    analysis.issues.push('Multiple scripts may impact FID - consider code splitting');
  }

  // CLS (Cumulative Layout Shift) - estimate based on content structure
  const hasFixedDimensions = $('img[width][height], [style*="width"][style*="height"]').length;
  const hasViewport = $('meta[name="viewport"]').length;

  if (hasFixedDimensions > 0 && hasViewport > 0) {
    analysis.coreWebVitals.CLS.value = '0.05';
    analysis.coreWebVitals.CLS.score = 95;
    analysis.coreWebVitals.CLS.status = 'good';
    analysis.score += 15;
  } else if (hasViewport > 0) {
    analysis.coreWebVitals.CLS.value = '0.15';
    analysis.coreWebVitals.CLS.score = 65;
    analysis.coreWebVitals.CLS.status = 'needs-improvement';
    analysis.score += 8;
  } else {
    analysis.coreWebVitals.CLS.value = '0.35';
    analysis.coreWebVitals.CLS.score = 20;
    analysis.coreWebVitals.CLS.status = 'poor';
    analysis.issues.push('Missing viewport meta tag - essential for mobile performance');
  }

  // Mobile-friendliness analysis
  analysis.mobileFriendly = hasViewport > 0;
  if (analysis.mobileFriendly) {
    analysis.score += 15;
    analysis.technicalSEO.score += 20;

    // Check for mobile-specific optimizations
    if ($('meta[name="theme-color"]').length > 0) {
      analysis.score += 5;
      analysis.technicalSEO.score += 10;
    }

    if ($('link[rel="manifest"]').length > 0) {
      analysis.score += 5;
      analysis.technicalSEO.score += 10;
    }
  } else {
    analysis.issues.push('Missing viewport meta tag - critical for mobile SEO');
    analysis.recommendations.push('Add <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  }

  // Technical SEO analysis
  // Check for meta robots
  const robotsMeta = $('meta[name="robots"]');
  if (robotsMeta.length > 0) {
    const robotsContent = robotsMeta.attr('content');
    if (robotsContent && !robotsContent.includes('noindex') && !robotsContent.includes('nofollow')) {
      analysis.technicalSEO.score += 20;
      analysis.score += 10;
    } else {
      analysis.issues.push('Robots meta tag may be blocking search engines');
    }
  }

  // Check for structured data density
  const jsonLdCount = $('script[type="application/ld+json"]').length;
  const microdataCount = $('[itemtype]').length;
  const rdfaCount = $('[typeof]').length;

  if (jsonLdCount > 0 || microdataCount > 0 || rdfaCount > 0) {
    analysis.technicalSEO.score += 20;
    analysis.score += 10;
  } else {
    analysis.issues.push('No structured data found - missing SEO opportunities');
  }

  // Check for external links
  const externalLinks = $('a[href^="http"]:not([href^="' + url + '"])').length;
  if (externalLinks > 0 && externalLinks < 10) {
    analysis.technicalSEO.score += 10;
  } else if (externalLinks >= 10) {
    analysis.technicalSEO.score += 5; // Good external linking
  }

  // Performance recommendations
  if (scripts > 5) {
    analysis.recommendations.push('Consider reducing JavaScript files or using code splitting');
  }

  if (stylesheets > 3) {
    analysis.recommendations.push('Consider combining CSS files or using critical CSS');
  }

  if (images > 10) {
    analysis.recommendations.push('Consider image optimization and lazy loading');
  }

  // Mobile recommendations
  if (!analysis.mobileFriendly) {
    analysis.recommendations.push('Implement responsive design for mobile SEO');
  }

  if (analysis.coreWebVitals.LCP.status === 'poor') {
    analysis.recommendations.push('Optimize Largest Contentful Paint (aim for < 2.5s)');
  }

  if (analysis.coreWebVitals.FID.status === 'poor') {
    analysis.recommendations.push('Reduce First Input Delay (aim for < 100ms)');
  }

  if (analysis.coreWebVitals.CLS.status === 'poor') {
    analysis.recommendations.push('Minimize Cumulative Layout Shift (aim for < 0.1)');
  }

  return analysis;
}
function analyzeJsonLdGraph(jsonLd) {
  const analysis = {
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    graphComplexity: 0,
    relationships: [],
    crossReferences: 0,
    schemaTypes: new Set(),
    depth: 0
  };

  // Find @graph structures
  const graphSchemas = jsonLd.filter(schema => schema['@graph']);

  if (graphSchemas.length === 0) {
    analysis.issues.push('No @graph structures found');
    analysis.recommendations.push('Consider using @graph for complex schema relationships');
    return analysis;
  }

  analysis.score += 20; // Has @graph structure

  graphSchemas.forEach(schema => {
    const graph = schema['@graph'];
    if (Array.isArray(graph)) {
      analysis.depth = Math.max(analysis.depth, graph.length);
      analysis.score += 15; // Multiple schemas in graph

      graph.forEach((item, index) => {
        const itemType = item['@type'] || item.type;
        if (itemType) {
          analysis.schemaTypes.add(itemType);
        }

        // Check for relationships
        if (item.sameAs || item.url) {
          analysis.crossReferences += 1;
        }

        // Check for nested properties
        Object.keys(item).forEach(key => {
          if (typeof item[key] === 'object' && item[key]['@type']) {
            analysis.relationships.push(`${itemType} -> ${item[key]['@type']}`);
            analysis.score += 5; // Nested schema relationships
          }
        });
      });

      // Graph complexity scoring
      if (graph.length > 5) {
        analysis.graphComplexity = 'high';
        analysis.score += 15;
      } else if (graph.length > 2) {
        analysis.graphComplexity = 'medium';
        analysis.score += 10;
      } else {
        analysis.graphComplexity = 'basic';
        analysis.score += 5;
      }
    }
  });

  // Remove duplicates from schema types
  analysis.schemaTypes = Array.from(analysis.schemaTypes);

  // Scoring for schema diversity
  if (analysis.schemaTypes.length > 3) {
    analysis.score += 15; // Good schema diversity
  } else if (analysis.schemaTypes.length > 1) {
    analysis.score += 10; // Basic schema diversity
  }

  // Cross-references scoring
  if (analysis.crossReferences > 0) {
    analysis.score += 10; // Has cross-references
  } else {
    analysis.recommendations.push('Add cross-references between related schemas');
  }

  // Recommendations
  if (analysis.depth < 3) {
    analysis.recommendations.push('Consider adding more schema entities to the @graph');
  }

  if (analysis.relationships.length === 0) {
    analysis.recommendations.push('Add nested schema relationships for better context');
  }

  if (analysis.schemaTypes.length < 2) {
    analysis.recommendations.push('Include multiple schema types in @graph for comprehensive data');
  }

  return analysis;
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Fetch HTML with timeout and user agent
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      maxRedirects: 5
    });

    const html = response.data;

    // Validate HTML content
    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'Invalid HTML content received from website.' });
    }

    let $;
    try {
      $ = cheerio.load(html);
    } catch (parseError) {
      console.error('HTML parsing error:', parseError.message);
      return res.status(400).json({ error: 'Unable to parse website HTML. The website may have malformed content.' });
    }

    // Extract all schema types
    let jsonLd = [], microdata = [], rdfa = [];
    try {
      jsonLd = extractJsonLd($);
    } catch (error) {
      console.error('JSON-LD extraction failed:', error.message);
    }

    try {
      microdata = extractMicrodata($);
    } catch (error) {
      console.error('Microdata extraction failed:', error.message);
    }

    try {
      rdfa = extractRdfa($);
    } catch (error) {
      console.error('RDFa extraction failed:', error.message);
    }

    // Analyze robots.txt and LLM.txt
    let robotsAnalysis = null;
    let llmAnalysis = null;

    try {
      robotsAnalysis = await analyzeRobotsTxt(url);
    } catch (error) {
      console.error('Robots.txt analysis failed:', error.message);
    }

    try {
      llmAnalysis = await analyzeLlmTxt(url);
    } catch (error) {
      console.error('LLM.txt analysis failed:', error.message);
    }

    // Analyze OpenGraph, AI.txt, and sitemap.xml
    let openGraphAnalysis = null;
    let aiAnalysis = null;
    let sitemapAnalysis = null;

    try {
      openGraphAnalysis = await analyzeOpenGraph(url);
    } catch (error) {
      console.error('OpenGraph analysis failed:', error.message);
    }

    try {
      aiAnalysis = await analyzeAiTxt(url);
    } catch (error) {
      console.error('AI.txt analysis failed:', error.message);
    }

    try {
      sitemapAnalysis = await analyzeSitemap(url);
    } catch (error) {
      console.error('Sitemap.xml analysis failed:', error.message);
    }

    // Analyze advanced AEO/GEO elements
    let faqHowToAnalysis = null;
    let breadcrumbAnalysis = null;
    let contentStructureAnalysis = null;
    let jsonLdGraphAnalysis = null;
    let performanceAnalysis = null;

    try {
      faqHowToAnalysis = analyzeFaqHowToSchema(jsonLd, microdata, rdfa);
    } catch (error) {
      console.error('FAQ/HowTo analysis failed:', error.message);
    }

    try {
      breadcrumbAnalysis = analyzeBreadcrumbs($);
    } catch (error) {
      console.error('Breadcrumb analysis failed:', error.message);
    }

    try {
      contentStructureAnalysis = analyzeContentStructure($);
    } catch (error) {
      console.error('Content structure analysis failed:', error.message);
    }

    try {
      jsonLdGraphAnalysis = analyzeJsonLdGraph(jsonLd);
    } catch (error) {
      console.error('JSON-LD graph analysis failed:', error.message);
    }

    try {
      performanceAnalysis = analyzePerformance($, html, url);
    } catch (error) {
      console.error('Performance analysis failed:', error.message);
    }
    const matched = [];

    // Check JSON-LD
    jsonLd.forEach((item, index) => {
      const schemaType = item['@type'] || item.type;
      if (schemaType && matchesTargetSchemas(schemaType)) {
        const validation = validateSchema(item, schemaType);
        matched.push({
          type: 'JSON-LD',
          schemaType: schemaType,
          data: item,
          index: index,
          validation: validation
        });
      }
    });

    // Check Microdata
    microdata.forEach((item, index) => {
      if (matchesTargetSchemas(item.type)) {
        const validation = validateSchema(item.properties, item.type);
        matched.push({
          type: 'Microdata',
          schemaType: item.type,
          data: item,
          index: index,
          validation: validation
        });
      }
    });

    // Check RDFa
    rdfa.forEach((item, index) => {
      if (matchesTargetSchemas(item.type)) {
        const validation = validateSchema(item.properties, item.type);
        matched.push({
          type: 'RDFa',
          schemaType: item.type,
          data: item,
          index: index,
          validation: validation
        });
      }
    });

    // Calculate overall validation score
    const totalValidationScore = matched.reduce((sum, match) => sum + match.validation.score, 0);
    const totalMaxScore = matched.reduce((sum, match) => sum + match.validation.maxScore, 0);
    const averageValidationScore = matched.length > 0 ? Math.round(totalValidationScore / matched.length) : 0;

    // Return results
    res.json({
      url: url,
      jsonLd: jsonLd,
      microdata: microdata,
      rdfa: rdfa,
      matched: matched,
      validation: {
        averageScore: averageValidationScore,
        totalScore: totalValidationScore,
        totalMaxScore: totalMaxScore,
        schemaCount: matched.length
      },
      robotsAnalysis: robotsAnalysis,
      llmAnalysis: llmAnalysis,
      openGraphAnalysis: openGraphAnalysis,
      aiAnalysis: aiAnalysis,
      sitemapAnalysis: sitemapAnalysis,
      faqHowToAnalysis: faqHowToAnalysis,
      breadcrumbAnalysis: breadcrumbAnalysis,
      contentStructureAnalysis: contentStructureAnalysis,
      jsonLdGraphAnalysis: jsonLdGraphAnalysis,
      performanceAnalysis: performanceAnalysis,
      totalFound: jsonLd.length + microdata.length + rdfa.length,
      totalMatched: matched.length
    });

  } catch (error) {
    console.error('Analysis error:', error.message);
    console.error('Full error:', error);

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(400).json({ error: 'Unable to reach the specified URL. Please check the URL and try again.' });
    }

    if (error.code === 'ETIMEDOUT') {
      return res.status(408).json({ error: 'Request timed out. The website took too long to respond.' });
    }

    if (error.response && error.response.status === 403) {
      return res.status(403).json({ error: 'Access denied by the website. The site may be blocking automated requests.' });
    }

    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Website not found (404 error).' });
    }

    if (error.response && error.response.status === 429) {
      return res.status(429).json({ error: 'Too many requests. The website is rate limiting our requests.' });
    }

    if (error.code === 'ECONNRESET' || error.code === 'EPROTO') {
      return res.status(400).json({ error: 'Connection error. The website may be using an incompatible protocol or SSL configuration.' });
    }

    // Log the specific error for debugging
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }

    res.status(500).json({ error: `An error occurred while analyzing the website: ${error.message}. Please try again.` });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Schema.org Validator running on http://localhost:${PORT}`);
  console.log(`Target schemas: ${TARGET_SCHEMAS.join(', ')}`);
});
