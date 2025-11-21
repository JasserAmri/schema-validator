// services/schemaValidator.js
// Schema validation engine with comprehensive validation rules

// Utilities
const TARGET_SCHEMAS = require('../constants/schemas');
const { isValidUrl, isAbsolute, absolutize } = require('../utils/urlUtils');
const { isValidDate, isValidTime } = require('../utils/dateUtils');
const { safeStr } = require('../utils/stringUtils');

// -------------------------------------
// Validation Rules (abbrev but solid)
// -------------------------------------
const SCHEMA_VALIDATION_RULES = {
  Hotel: {
    docs: 'https://schema.org/Hotel',
    required: ['name', 'address'],
    recommended: ['telephone', 'description', 'image', 'priceRange', 'amenityFeature', 'url'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      image: { type: 'url', docs: 'https://schema.org/image' },
      url: { type: 'url', docs: 'https://schema.org/url' },
      telephone: { type: 'string', docs: 'https://schema.org/telephone' },
      address: { type: 'object', required: true, docs: 'https://schema.org/address' },
      priceRange: { type: 'string', docs: 'https://schema.org/priceRange' },
      amenityFeature: { type: 'array', docs: 'https://schema.org/amenityFeature' },
      checkinTime: { type: 'string', format: 'time', docs: 'https://schema.org/checkinTime' },
      checkoutTime: { type: 'string', format: 'time', docs: 'https://schema.org/checkoutTime' }
    }
  },
  LodgingBusiness: {
    docs: 'https://schema.org/LodgingBusiness',
    required: ['name', 'address'],
    recommended: ['telephone', 'description', 'image', 'priceRange', 'url'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      image: { type: 'url', docs: 'https://schema.org/image' },
      url: { type: 'url', docs: 'https://schema.org/url' },
      telephone: { type: 'string', docs: 'https://schema.org/telephone' },
      address: { type: 'object', required: true, docs: 'https://schema.org/address' },
      priceRange: { type: 'string', docs: 'https://schema.org/priceRange' }
    }
  },
  Organization: {
    docs: 'https://schema.org/Organization',
    required: ['name'],
    recommended: ['url', 'description', 'image', 'address', 'telephone', 'sameAs', 'logo'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      url: { type: 'url', docs: 'https://schema.org/url' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      image: { type: 'url', docs: 'https://schema.org/image' },
      logo: { type: 'url', docs: 'https://schema.org/logo' },
      address: { type: 'object', docs: 'https://schema.org/address' },
      telephone: { type: 'string', docs: 'https://schema.org/telephone' },
      sameAs: { type: 'array', docs: 'https://schema.org/sameAs' }
    }
  },
  LocalBusiness: {
    docs: 'https://schema.org/LocalBusiness',
    required: ['name', 'address'],
    recommended: ['telephone', 'description', 'image', 'url', 'priceRange', 'openingHours', 'geo', 'sameAs'],
    properties: {
      name: { docs: 'https://schema.org/name' },
      description: { docs: 'https://schema.org/description' },
      image: { type: 'url', docs: 'https://schema.org/image' },
      url: { type: 'url', docs: 'https://schema.org/url' },
      telephone: { type: 'string', docs: 'https://schema.org/telephone' },
      address: { type: 'object', docs: 'https://schema.org/address' },
      priceRange: { type: 'string', docs: 'https://schema.org/priceRange' },
      openingHours: { type: 'string', docs: 'https://schema.org/openingHours' },
      geo: { type: 'object', docs: 'https://schema.org/geo' },
      sameAs: { type: 'array', docs: 'https://schema.org/sameAs' }
    }
  },
  FAQPage: {
    docs: 'https://schema.org/FAQPage',
    required: ['mainEntity'],
    recommended: ['name', 'description'],
    properties: {
      mainEntity: { type: 'array', required: true, docs: 'https://schema.org/mainEntity' },
      name: { type: 'string', docs: 'https://schema.org/name' },
      description: { type: 'string', docs: 'https://schema.org/description' }
    }
  },
  HowTo: {
    docs: 'https://schema.org/HowTo',
    required: ['name', 'step'],
    recommended: ['description', 'image', 'supply', 'tool', 'totalTime'],
    properties: {
      name: { type: 'string', required: true, docs: 'https://schema.org/name' },
      step: { type: 'array', required: true, docs: 'https://schema.org/step' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      image: { type: 'url', docs: 'https://schema.org/image' },
      supply: { type: 'array', docs: 'https://schema.org/supply' },
      tool: { type: 'array', docs: 'https://schema.org/tool' },
      totalTime: { type: 'string', docs: 'https://schema.org/totalTime' }
    }
  },
  Review: {
    docs: 'https://schema.org/Review',
    required: ['reviewRating', 'author'],
    recommended: ['reviewBody', 'datePublished', 'itemReviewed'],
    properties: {
      reviewRating: { type: 'object', required: true, docs: 'https://schema.org/reviewRating' },
      author: { type: 'object', required: true, docs: 'https://schema.org/author' },
      reviewBody: { type: 'string', docs: 'https://schema.org/reviewBody' },
      datePublished: { type: 'string', format: 'date', docs: 'https://schema.org/datePublished' },
      itemReviewed: { type: 'object', docs: 'https://schema.org/itemReviewed' }
    }
  },
  AggregateRating: {
    docs: 'https://schema.org/AggregateRating',
    required: ['ratingValue', 'reviewCount'],
    recommended: ['bestRating', 'worstRating'],
    properties: {
      ratingValue: { type: 'number', docs: 'https://schema.org/ratingValue' },
      reviewCount: { type: 'number', docs: 'https://schema.org/reviewCount' },
      bestRating: { type: 'number', docs: 'https://schema.org/bestRating' },
      worstRating: { type: 'number', docs: 'https://schema.org/worstRating' }
    }
  },
  Place: {
    docs: 'https://schema.org/Place',
    required: ['name'],
    recommended: ['address', 'description', 'image', 'url', 'telephone', 'geo'],
    properties: {
      name: { type: 'string', docs: 'https://schema.org/name' },
      address: { type: 'object', docs: 'https://schema.org/address' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      image: { type: 'url', docs: 'https://schema.org/image' },
      url: { type: 'url', docs: 'https://schema.org/url' },
      telephone: { type: 'string', docs: 'https://schema.org/telephone' },
      geo: { type: 'object', docs: 'https://schema.org/geo' }
    }
  },
  Product: {
    docs: 'https://schema.org/Product',
    required: ['name'],
    recommended: ['description', 'image', 'offers', 'category', 'brand', 'aggregateRating'],
    properties: {
      name: { type: 'string', docs: 'https://schema.org/name' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      image: { type: 'url', docs: 'https://schema.org/image' },
      url: { type: 'url', docs: 'https://schema.org/url' },
      category: { type: 'string', docs: 'https://schema.org/category' },
      brand: { type: 'object', docs: 'https://schema.org/brand' },
      offers: { type: 'object', docs: 'https://schema.org/offers' },
      aggregateRating: { type: 'object', docs: 'https://schema.org/aggregateRating' },
      priceRange: { type: 'string', docs: 'https://schema.org/priceRange' }
    }
  },
  Service: {
    docs: 'https://schema.org/Service',
    required: ['name', 'provider'],
    recommended: ['description', 'image', 'offers', 'serviceType'],
    properties: {
      name: { type: 'string', docs: 'https://schema.org/name' },
      provider: { type: 'object', docs: 'https://schema.org/provider' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      image: { type: 'url', docs: 'https://schema.org/image' },
      serviceType: { type: 'string', docs: 'https://schema.org/serviceType' },
      url: { type: 'url', docs: 'https://schema.org/url' },
      offers: { type: 'object', docs: 'https://schema.org/offers' },
      areaServed: { type: 'object', docs: 'https://schema.org/areaServed' }
    }
  },
  JobPosting: {
    docs: 'https://schema.org/JobPosting',
    required: ['title', 'hiringOrganization'],
    recommended: ['description', 'datePosted', 'employmentType', 'jobLocation'],
    properties: {
      title: { type: 'string', docs: 'https://schema.org/title' },
      hiringOrganization: { type: 'object', docs: 'https://schema.org/hiringOrganization' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      datePosted: { type: 'string', format: 'date', docs: 'https://schema.org/datePosted' },
      employmentType: { type: 'string', docs: 'https://schema.org/employmentType' },
      jobLocation: { type: 'object', docs: 'https://schema.org/jobLocation' },
      salaryCurrency: { type: 'string', docs: 'https://schema.org/salaryCurrency' }
    }
  },
  Restaurant: {
    docs: 'https://schema.org/Restaurant',
    required: ['name', 'address'],
    recommended: ['telephone', 'description', 'image', 'priceRange', 'servesCuisine', 'menu'],
    properties: {
      name: { type: 'string', docs: 'https://schema.org/name' },
      address: { type: 'object', docs: 'https://schema.org/address' },
      telephone: { type: 'string', docs: 'https://schema.org/telephone' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      image: { type: 'url', docs: 'https://schema.org/image' },
      priceRange: { type: 'string', docs: 'https://schema.org/priceRange' },
      servesCuisine: { type: 'string', docs: 'https://schema.org/servesCuisine' },
      menu: { type: 'url', docs: 'https://schema.org/menu' },
      acceptsReservations: { type: 'boolean', docs: 'https://schema.org/acceptsReservations' }
    }
  },
  Event: {
    docs: 'https://schema.org/Event',
    required: ['name', 'startDate'],
    recommended: ['description', 'endDate', 'location', 'offers', 'image', 'url', 'eventStatus'],
    properties: {
      name: { type: 'string', docs: 'https://schema.org/name' },
      startDate: { type: 'string', format: 'date', docs: 'https://schema.org/startDate' },
      endDate: { type: 'string', format: 'date', docs: 'https://schema.org/endDate' },
      location: { type: 'object', docs: 'https://schema.org/location' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      image: { type: 'url', docs: 'https://schema.org/image' },
      url: { type: 'url', docs: 'https://schema.org/url' },
      offers: { type: 'object', docs: 'https://schema.org/offers' },
      eventStatus: { type: 'string', docs: 'https://schema.org/eventStatus' }
    }
  },
  BusinessEvent: {
    docs: 'https://schema.org/BusinessEvent',
    required: ['name', 'startDate'],
    recommended: ['description', 'endDate', 'location', 'organizer', 'image'],
    properties: {
      name: { type: 'string', docs: 'https://schema.org/name' },
      startDate: { type: 'string', format: 'date', docs: 'https://schema.org/startDate' },
      endDate: { type: 'string', format: 'date', docs: 'https://schema.org/endDate' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      location: { type: 'object', docs: 'https://schema.org/location' },
      organizer: { type: 'object', docs: 'https://schema.org/organizer' },
      image: { type: 'url', docs: 'https://schema.org/image' }
    }
  },
  WebSite: {
    docs: 'https://schema.org/WebSite',
    required: ['name'],
    recommended: ['url', 'potentialAction'],
    properties: {
      name: { type: 'string', docs: 'https://schema.org/name' },
      url: { type: 'url', docs: 'https://schema.org/url' },
      potentialAction: { type: 'object', docs: 'https://schema.org/potentialAction' }
    }
  },
  BreadcrumbList: {
    docs: 'https://schema.org/BreadcrumbList',
    required: ['itemListElement'],
    recommended: [],
    properties: {
      itemListElement: { type: 'array', docs: 'https://schema.org/itemListElement' }
    }
  },
  VideoObject: {
    docs: 'https://schema.org/VideoObject',
    required: ['name', 'thumbnailUrl', 'uploadDate'],
    recommended: ['description', 'contentUrl', 'embedUrl', 'duration', 'inLanguage'],
    properties: {
      name: { type: 'string', docs: 'https://schema.org/name' },
      thumbnailUrl: { type: 'url', docs: 'https://schema.org/thumbnailUrl' },
      uploadDate: { type: 'string', format: 'date', docs: 'https://schema.org/uploadDate' },
      description: { type: 'string', docs: 'https://schema.org/description' },
      contentUrl: { type: 'url', docs: 'https://schema.org/contentUrl' },
      embedUrl: { type: 'url', docs: 'https://schema.org/embedUrl' },
      duration: { type: 'string', docs: 'https://schema.org/duration' },
      inLanguage: { type: 'string', docs: 'https://schema.org/inLanguage' }
    }
  },
  ImageObject: {
    docs: 'https://schema.org/ImageObject',
    required: ['url'],
    recommended: ['width', 'height', 'caption'],
    properties: {
      url: { type: 'url', docs: 'https://schema.org/url' },
      width: { type: 'number', docs: 'https://schema.org/width' },
      height: { type: 'number', docs: 'https://schema.org/height' },
      caption: { type: 'string', docs: 'https://schema.org/caption' }
    }
  },
  ItemList: {
    docs: 'https://schema.org/ItemList',
    required: ['itemListElement'],
    recommended: ['name'],
    properties: {
      itemListElement: { type: 'array', docs: 'https://schema.org/itemListElement' },
      name: { type: 'string', docs: 'https://schema.org/name' }
    }
  },
  PostalAddress: {
    docs: 'https://schema.org/PostalAddress',
    required: ['streetAddress', 'postalCode', 'addressLocality'],
    recommended: [],
    properties: {
      streetAddress: { type: 'string', docs: 'https://schema.org/streetAddress' },
      postalCode: { type: 'string', docs: 'https://schema.org/postalCode' },
      addressLocality: { type: 'string', docs: 'https://schema.org/addressLocality' }
    }
  },
  GeoCoordinates: {
    docs: 'https://schema.org/GeoCoordinates',
    required: ['latitude', 'longitude'],
    recommended: [],
    properties: {
      latitude: { type: 'number', docs: 'https://schema.org/latitude' },
      longitude: { type: 'number', docs: 'https://schema.org/longitude' }
    }
  },
  Offer: {
    docs: 'https://schema.org/Offer',
    required: ['name'],
    recommended: ['price', 'priceCurrency', 'availability', 'url'],
    properties: {
      name: { type: 'string', docs: 'https://schema.org/name' },
      price: { type: 'number', docs: 'https://schema.org/price' },
      priceCurrency: { type: 'string', docs: 'https://schema.org/priceCurrency' },
      availability: { type: 'string', docs: 'https://schema.org/availability' },
      url: { type: 'url', docs: 'https://schema.org/url' }
    }
  }
};

function validateSchema(schema, schemaType) {
  const validation = {
    isValid: true,
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    schemaDocs: SCHEMA_VALIDATION_RULES[schemaType]?.docs || ''
  };

  const rules = SCHEMA_VALIDATION_RULES[schemaType];
  if (!rules) {
    validation.issues.push(`Unknown schema type: ${schemaType}`);
    validation.isValid = false;
    return validation;
  }

  let reqScore = 0;
  let recScore = 0;

  (rules.required || []).forEach(prop => {
    if (schema[prop] == null && schema['@' + prop] == null) {
      validation.issues.push({
        message: `Missing required property: ${prop}`,
        docs: rules.properties[prop]?.docs || rules.docs,
        property: prop,
        type: 'required'
      });
      validation.isValid = false;
    } else {
      reqScore += 25;
    }
  });

  (rules.recommended || []).forEach(prop => {
    if (schema[prop] == null && schema['@' + prop] == null) {
      validation.recommendations.push({
        message: `Consider adding recommended property: ${prop}`,
        docs: rules.properties[prop]?.docs || rules.docs,
        property: prop,
        type: 'recommended'
      });
    } else {
      recScore += 15;
    }
  });

  // type/format checks
  Object.entries(rules.properties || {}).forEach(([prop, rule]) => {
    const value = schema[prop] ?? schema['@' + prop];
    if (value == null) return;

    if (rule.type === 'url') {
      const v = Array.isArray(value) ? value[0] : value;
      if (!isValidUrl(v)) {
        validation.issues.push({
          message: `Invalid URL format for property: ${prop}`,
          docs: rule.docs, property: prop, type: 'format'
        });
      }
    }
    if (rule.type === 'number') {
      const v = Array.isArray(value) ? value[0] : value;
      if (isNaN(Number(v))) {
        validation.issues.push({
          message: `Invalid number format for property: ${prop}`,
          docs: rule.docs, property: prop, type: 'format'
        });
      }
    }
    if (rule.format === 'date') {
      const v = Array.isArray(value) ? value[0] : value;
      if (!isValidDate(v)) {
        validation.issues.push({
          message: `Invalid date format for property: ${prop}`,
          docs: rule.docs, property: prop, type: 'format'
        });
      }
    }
    if (rule.format === 'time') {
      const v = Array.isArray(value) ? value[0] : value;
      if (!isValidTime(v)) {
        validation.issues.push({
          message: `Invalid time format for property: ${prop}`,
          docs: rule.docs, property: prop, type: 'format'
        });
      }
    }
  });

  validation.score = reqScore + recScore;
  validation.maxScore = (rules.required.length * 25) + (rules.recommended.length * 15);
  return validation;
}

// Schema.org official property vocabularies for common types
const SCHEMA_ORG_PROPERTIES = {
  Question: ['@context', '@type', '@id', 'acceptedAnswer', 'answerCount', 'author', 'dateCreated', 'dateModified', 'datePublished', 'name', 'text', 'suggestedAnswer', 'upvoteCount', 'downvoteCount'],
  Answer: ['@context', '@type', '@id', 'text', 'author', 'dateCreated', 'dateModified', 'datePublished', 'upvoteCount', 'downvoteCount', 'url'],
  FAQPage: ['@context', '@type', '@id', 'mainEntity', 'name', 'description', 'url', 'breadcrumb', 'inLanguage'],
  Hotel: ['@context', '@type', '@id', 'name', 'description', 'image', 'address', 'telephone', 'email', 'url', 'priceRange', 'starRating', 'aggregateRating', 'amenityFeature', 'checkinTime', 'checkoutTime', 'petsAllowed', 'numberOfRooms', 'geo', 'sameAs'],
  PostalAddress: ['@context', '@type', 'streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry'],
  Rating: ['@context', '@type', 'ratingValue', 'bestRating', 'worstRating', 'ratingCount', 'reviewCount'],
  AggregateRating: ['@context', '@type', 'ratingValue', 'bestRating', 'worstRating', 'ratingCount', 'reviewCount'],
  Review: ['@context', '@type', '@id', 'author', 'datePublished', 'reviewBody', 'reviewRating', 'itemReviewed'],
  Organization: ['@context', '@type', '@id', 'name', 'url', 'logo', 'sameAs', 'contactPoint', 'address', 'telephone', 'email'],
  Person: ['@context', '@type', '@id', 'name', 'url', 'image', 'sameAs', 'jobTitle', 'worksFor'],
  BreadcrumbList: ['@context', '@type', 'itemListElement'],
  ListItem: ['@context', '@type', 'position', 'name', 'item'],
  WebPage: ['@context', '@type', '@id', 'name', 'url', 'description', 'inLanguage', 'isPartOf', 'breadcrumb', 'datePublished', 'dateModified'],
  WebSite: ['@context', '@type', '@id', 'name', 'url', 'description', 'potentialAction'],
  ImageObject: ['@context', '@type', '@id', 'url', 'width', 'height', 'caption', 'contentUrl'],
  HowTo: ['@context', '@type', '@id', 'name', 'description', 'image', 'step', 'totalTime', 'tool', 'supply'],
  HowToStep: ['@context', '@type', 'name', 'text', 'url', 'image', 'position'],
  Place: ['@context', '@type', '@id', 'name', 'address', 'geo', 'url', 'telephone', 'image'],
  GeoCoordinates: ['@context', '@type', 'latitude', 'longitude', 'elevation']
};

// Detect non-standard Schema.org properties
function detectNonStandardProperties(schema, schemaType) {
  if (process.env.ENABLE_NON_STANDARD_WARNINGS !== 'true') {
    return [];
  }

  const warnings = [];
  const officialProps = SCHEMA_ORG_PROPERTIES[schemaType] || [];

  if (officialProps.length === 0) {
    // Unknown type, skip validation
    return warnings;
  }

  Object.keys(schema).forEach(prop => {
    // Skip standard context/type/id props
    if (['@context', '@type', '@id'].includes(prop)) return;

    // Check if property exists in official vocabulary
    if (!officialProps.includes(prop)) {
      warnings.push({
        property: prop,
        message: `Non-standard property detected: "${prop}" is not in the official Schema.org vocabulary for ${schemaType}`,
        type: 'non-standard',
        severity: 'warning'
      });
    }

    // Recursively check nested objects
    const value = schema[prop];
    if (value && typeof value === 'object' && !Array.isArray(value) && value['@type']) {
      const nestedWarnings = detectNonStandardProperties(value, value['@type']);
      warnings.push(...nestedWarnings);
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'object' && item['@type']) {
          const nestedWarnings = detectNonStandardProperties(item, item['@type']);
          warnings.push(...nestedWarnings);
        }
      });
    }
  });

  return warnings;
}

// Analyze HTML content in text fields
function analyzeHtmlContent(schema, schemaType, path = '') {
  if (process.env.ENABLE_HTML_CONTENT_ANALYSIS !== 'true') {
    return [];
  }

  const warnings = [];
  const htmlTagPattern = /<[^>]+>/g;
  const textFields = ['text', 'name', 'description', 'reviewBody', 'headline', 'articleBody'];

  Object.entries(schema).forEach(([key, value]) => {
    const currentPath = path ? `${path}.${key}` : key;

    // Check if this is a text field
    if (textFields.includes(key) && typeof value === 'string') {
      const htmlMatches = value.match(htmlTagPattern);
      if (htmlMatches && htmlMatches.length > 0) {
        const tags = [...new Set(htmlMatches.map(tag => tag.match(/<\/?(\w+)/)?.[1]).filter(Boolean))];
        warnings.push({
          property: currentPath,
          message: `HTML tags found in text field "${key}": ${tags.join(', ')}. While technically valid, this may cause rendering issues in search results.`,
          type: 'html-content',
          severity: 'info',
          tags: tags,
          excerpt: value.substring(0, 100) + (value.length > 100 ? '...' : '')
        });
      }
    }

    // Recursively check nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedWarnings = analyzeHtmlContent(value, schemaType, currentPath);
      warnings.push(...nestedWarnings);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') {
          const nestedWarnings = analyzeHtmlContent(item, schemaType, `${currentPath}[${index}]`);
          warnings.push(...nestedWarnings);
        }
      });
    }
  });

  return warnings;
}

// Check date freshness (for dateModified, datePublished)
function checkDateFreshness(schema, path = '') {
  if (process.env.ENABLE_DATE_FRESHNESS_CHECK !== 'true') {
    return [];
  }

  const warnings = [];
  const dateFields = ['dateModified', 'datePublished', 'dateCreated'];
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  Object.entries(schema).forEach(([key, value]) => {
    const currentPath = path ? `${path}.${key}` : key;

    if (dateFields.includes(key) && typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const ageInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (date < twoYearsAgo) {
          warnings.push({
            property: currentPath,
            message: `${key} is over 2 years old (${ageInDays} days). Very stale content may lose ranking in search results.`,
            type: 'date-freshness',
            severity: 'warning',
            date: value,
            ageInDays
          });
        } else if (date < oneYearAgo) {
          warnings.push({
            property: currentPath,
            message: `${key} is over 1 year old (${ageInDays} days). Consider updating for better freshness signals.`,
            type: 'date-freshness',
            severity: 'info',
            date: value,
            ageInDays
          });
        }
      }
    }

    // Recursively check nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedWarnings = checkDateFreshness(value, currentPath);
      warnings.push(...nestedWarnings);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') {
          const nestedWarnings = checkDateFreshness(item, `${currentPath}[${index}]`);
          warnings.push(...nestedWarnings);
        }
      });
    }
  });

  return warnings;
}

module.exports = {
  validateSchema,
  detectNonStandardProperties,
  analyzeHtmlContent,
  checkDateFreshness
};
