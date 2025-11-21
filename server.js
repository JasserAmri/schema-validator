// server.js
// Schema / SEO / AEO / GEO Analyzer (full, hardened)
// ---------------------------------------------------

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// -------------------------------------
// App setup
// -------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' :
          (process.env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim()),
  optionsSuccessStatus: 200
};

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', limiter);
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------
// Constants / helpers
// -------------------------------------
const TARGET_SCHEMAS = [
  'Hotel', 'LodgingBusiness', 'FAQPage', 'Organization', 'Review', 'AggregateRating',
  'LocalBusiness', 'Place', 'Product', 'Service', 'JobPosting', 'Restaurant',
  'Event', 'BusinessEvent', 'HowTo', 'Article', 'QAPage', 'WebSite', 'BreadcrumbList',
  'VideoObject', 'ImageObject', 'ItemList', 'PostalAddress', 'GeoCoordinates', 'Offer'
];

function safeStr(x) {
  return (typeof x === 'string') ? x : '';
}

function normalizeType(raw) {
  if (!raw) return '';
  if (Array.isArray(raw)) return raw.map(s => String(s)).join(',');
  return String(raw);
}

function isValidUrl(value) {
  try { new URL(value); return true; } catch { return false; }
}

function isValidDate(value) {
  // ISO-ish date test
  return /^\d{4}-\d{2}-\d{2}([Tt ][\d:.\-+Zz]+)?$/.test(String(value));
}

function isValidTime(value) {
  const s = String(value);
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s) || /^\d{2}:\d{2}:\d{2}$/.test(s);
}

function isAbsolute(url) {
  return /^https?:\/\//i.test(String(url || ''));
}

function absolutize(url, base) {
  try {
    if (!url) return url;
    const abs = new URL(url, base);
    return abs.href;
  } catch {
    return url;
  }
}

function textFrom($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim();
}

// Pure-JS Flesch-Kincaid helpers
function countSyllables(word) {
  const w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  return (w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g) || []).length;
}
function countWords(text) {
  return (String(text || '').match(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g) || []).length;
}
function countSentences(text) {
  // heuristic: split on ., !, ?
  const s = String(text || '').split(/[.!?]+/).filter(Boolean);
  return Math.max(1, s.length);
}
function fleschKincaidReadingEase(text) {
  const words = countWords(text);
  const sentences = countSentences(text);
  const syllables = (String(text || '').match(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g) || [])
    .reduce((sum, w) => sum + countSyllables(w), 0);
  if (words === 0) return 0;
  const ASL = words / sentences;       // average sentence length
  const ASW = syllables / words;       // average syllables per word
  // Flesch Reading Ease (higher is easier): 206.835 − 1.015×ASL − 84.6×ASW
  const score = 206.835 - (1.015 * ASL) - (84.6 * ASW);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// -------------------------------------
// Extraction: JSON-LD, Microdata, RDFa
// -------------------------------------
function cleanJsonLikeString(s) {
  let content = String(s || '').trim();
  if (!content) return '';

  // Remove HTML comments
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // Fix property names missing quotes: { foo: 1 } -> { "foo": 1 }
  content = content.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');

  // Remove trailing commas before } or ]
  content = content.replace(/,(\s*[}\]])/g, '$1');

  // Remove trailing comma at end
  content = content.replace(/,\s*$/, '');

  return content;
}

function extractJsonLd($) {
  const out = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      let content = $(el).html();
      if (!content) return;
      content = cleanJsonLikeString(content);
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        // try @graph extraction
        const graphMatch = content.match(/"@graph"\s*:\s*(\[[\s\S]*?\])/);
        if (graphMatch) {
          try {
            const g = JSON.parse(graphMatch[1]);
            if (Array.isArray(g)) {
              g.forEach(node => out.push(node));
              return;
            }
          } catch {}
        }
        return; // skip malformed
      }

      if (Array.isArray(parsed)) {
        parsed.forEach(item => out.push(item));
      } else if (parsed && typeof parsed === 'object') {
        if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
          parsed['@graph'].forEach(item => out.push(item));
        } else {
          out.push(parsed);
        }
      }
    } catch (e) {
      // skip
    }
  });

  // Normalize @type to string, and absolutize URLs where safe
  return out.map(obj => normalizeSchemaObject(obj));
}

function normalizeSchemaObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = JSON.parse(JSON.stringify(obj));

  // normalize @type to string (if array, join with comma for display/validation)
  if (clone['@type']) clone['@type'] = normalizeType(clone['@type']);
  if (!clone['@type'] && clone.type) {
    clone['@type'] = normalizeType(clone.type);
    delete clone.type;
  }
  return clone;
}

function extractMicrodata($, baseUrl) {
  const results = [];

  $('[itemscope]').each((i, elem) => {
    const $el = $(elem);
    const itemtype = $el.attr('itemtype') || '';
    const type = itemtype.includes('schema.org/')
      ? itemtype.replace(/^https?:\/\/schema\.org\//, '')
      : '';
    const item = { '@type': type || 'Thing' };

    // Collect itemprops *within* this itemscope (not in nested scopes)
    const props = {};
    $el.find('[itemprop]').each((j, propEl) => {
      const $p = $(propEl);
      // ensure this prop belongs to current itemscope (closest itemscope is self or descendant)
      const ownerScope = $p.closest('[itemscope]').get(0);
      if (ownerScope !== elem) return; // belongs to nested scope; skip at this level

      const propName = $p.attr('itemprop');
      let value =
        $p.attr('content') ||
        $p.attr('href') ||
        $p.attr('src') ||
        textFrom($, $p);

      // absolutize href/src if present
      if (($p.is('a') || $p.is('img') || $p.attr('href') || $p.attr('src')) && baseUrl) {
        value = absolutize(value, baseUrl);
      }

      // If this prop is also an itemscope, parse nested as object
      if ($p.is('[itemscope]')) {
        const nested = extractMicrodata($p, baseUrl);
        // nested will return array with a root; take first
        if (nested.length > 0) value = nested[0];
      }

      if (propName) {
        if (props[propName]) {
          if (!Array.isArray(props[propName])) props[propName] = [props[propName]];
          props[propName].push(value);
        } else {
          props[propName] = value;
        }
      }
    });

    Object.assign(item, props);
    results.push(item);
  });

  return results.map(obj => normalizeSchemaObject(obj));
}

function extractRdfa($, baseUrl) {
  const results = [];
  $('[typeof]').each((i, elem) => {
    const $el = $(elem);
    let type = $el.attr('typeof') || '';
    if (type.includes('schema:')) type = type.replace(/schema:/g, '');
    if (type.includes('schema.org/')) type = type.replace(/^https?:\/\/schema\.org\//, '');

    const item = { '@type': type || 'Thing' };
    const props = {};
    $el.find('[property]').each((j, propEl) => {
      const $p = $(propEl);
      const propName = ($p.attr('property') || '').replace(/^schema:/, '');
      let value =
        $p.attr('content') ||
        $p.attr('href') ||
        $p.attr('src') ||
        textFrom($, $p);

      if (($p.attr('href') || $p.attr('src')) && baseUrl) {
        value = absolutize(value, baseUrl);
      }

      if (propName) {
        if (props[propName]) {
          if (!Array.isArray(props[propName])) props[propName] = [props[propName]];
          props[propName].push(value);
        } else {
          props[propName] = value;
        }
      }
    });

    Object.assign(item, props);
    results.push(item);
  });

  return results.map(obj => normalizeSchemaObject(obj));
}

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

function matchesTargetSchemas(schemaType) {
  const t = String(schemaType || '');
  return TARGET_SCHEMAS.some(target =>
    t.toLowerCase().includes(target.toLowerCase()) ||
    target.toLowerCase().includes(t.toLowerCase())
  );
}

// -------------------------------------
// JavaScript Rendering (Puppeteer)
// -------------------------------------
async function renderPageWithJavaScript(url) {
  if (process.env.ENABLE_JS_RENDERING !== 'true') {
    return null;
  }

  let browser = null;
  try {
    // Use @sparticuz/chromium for Vercel serverless compatibility
    const launchOptions = {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    };

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set extra headers for bot bypass
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    });

    // Navigate and wait for network to be idle
    const timeout = parseInt(process.env.TIMEOUT_JS_RENDER || '30000');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: timeout
    });

    // Wait additional time for dynamic content
    await page.waitForTimeout(2000);

    // Extract final HTML with all JavaScript-generated content
    const html = await page.content();

    await browser.close();

    return {
      html,
      success: true,
      method: 'puppeteer'
    };

  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }

    console.error('JavaScript rendering error:', error.message);

    return {
      html: null,
      success: false,
      method: 'puppeteer',
      error: error.message
    };
  }
}

// -------------------------------------
// Robots, LLMs, AI, OpenGraph, Sitemap
// -------------------------------------
async function analyzeRobotsTxt(url) {
  const analysis = {
    exists: false, score: 0, maxScore: 100,
    issues: [], recommendations: [],
    aiCrawlers: [], sitemapFound: false, sitemapUrl: null, userAgents: []
  };

  try {
    const robotsUrl = new URL('/robots.txt', url).href;
    const timeout = parseInt(process.env.TIMEOUT_ROBOTS || '6000');
    const res = await axios.get(robotsUrl, {
      timeout,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || '10485760')
    });
    analysis.exists = true;
    const content = String(res.data || '');
    const lines = content.split('\n');
    let currentUA = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        currentUA = trimmed.substring(11).trim().toLowerCase();
        analysis.userAgents.push(currentUA);
        if (currentUA.includes('gptbot') || currentUA.includes('chatgpt')) analysis.aiCrawlers.push('GPTBot');
        if (currentUA.includes('claude')) analysis.aiCrawlers.push('ClaudeBot');
        if (currentUA.includes('perplexity')) analysis.aiCrawlers.push('PerplexityBot');
      }
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        analysis.sitemapFound = true;
        analysis.sitemapUrl = trimmed.substring(8).trim();
      }
    });

    analysis.aiCrawlers = [...new Set(analysis.aiCrawlers)];
    if (analysis.exists) analysis.score += 30;
    if (analysis.aiCrawlers.length > 0) analysis.score += 25; else analysis.recommendations.push('Consider adding AI crawler permissions (GPTBot, ClaudeBot, Perplexity).');
    if (analysis.sitemapFound) analysis.score += 20; else analysis.issues.push('Missing sitemap declaration in robots.txt');
    if (analysis.userAgents.length > 1) analysis.score += 15;
    if (!/crawl-delay/i.test(content)) analysis.recommendations.push('Consider adding crawl-delay to protect performance.');
    if (/Disallow:\s*\/\s*$/i.test(content)) analysis.recommendations.push('robots.txt blocks everything—ensure that’s intended.');

  } catch (e) {
    analysis.issues.push('robots.txt not found or not accessible');
    analysis.recommendations.push('Create a robots.txt at site root with sitemap and bot directives.');
  }
  return analysis;
}

async function analyzeLlmTxt(url) {
  const analysis = { exists: false, score: 0, maxScore: 100, issues: [], recommendations: [], sections: [], aiGuidelines: [], businessInfo: false, hasContact: false, contentQuality: 'none' };
  try {
    const llmsUrl = new URL('/llms.txt', url).href;
    const timeout = parseInt(process.env.TIMEOUT_GENERAL || '6000');
    const res = await axios.get(llmsUrl, {
      timeout,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || '10485760')
    });
    analysis.exists = true;
    const content = String(res.data || '');
    const lines = content.split('\n');
    let hasGuidelines = false, hasBusiness = false, hasContact = false;

    lines.forEach(l => {
      const t = l.trim();
      if (!t) return;
      if (t.startsWith('# ')) {
        const section = t.substring(2).trim();
        analysis.sections.push(section);
        if (/about|business|company/i.test(section)) hasBusiness = true;
      }
      if (/guidelines|ai systems|usage/i.test(t)) hasGuidelines = true;
      if (/contact|email|phone/i.test(t)) hasContact = true;
    });

    analysis.businessInfo = hasBusiness;
    analysis.hasContact = hasContact;
    if (hasGuidelines) analysis.aiGuidelines.push('AI usage guidelines present');

    const len = content.length;
    if (len > 500) { analysis.contentQuality = 'comprehensive'; analysis.score += 40; }
    else if (len > 200) { analysis.contentQuality = 'good'; analysis.score += 25; }
    else if (len > 50) { analysis.contentQuality = 'basic'; analysis.score += 10; }

    if (analysis.sections.length) analysis.score += 20; else analysis.issues.push('Add headers/sections to llms.txt');
    if (hasBusiness) analysis.score += 20; else analysis.recommendations.push('Include a business overview section.');
    if (hasGuidelines) analysis.score += 15; else analysis.recommendations.push('Add AI usage guidelines section.');
    if (hasContact) analysis.score += 5; else analysis.recommendations.push('Consider contact details for AI systems.');

  } catch {
    analysis.issues.push('llms.txt not found or not accessible');
    analysis.recommendations.push('Create an llms.txt that describes your business and AI usage guidelines.');
  }
  return analysis;
}

async function analyzeAiTxt(url) {
  const analysis = { exists: false, score: 0, maxScore: 100, issues: [], recommendations: [], aiCrawlers: [], usageGuidelines: [], attributionRequired: false };
  try {
    const aiUrl = new URL('/ai.txt', url).href;
    const timeout = parseInt(process.env.TIMEOUT_GENERAL || '6000');
    const res = await axios.get(aiUrl, {
      timeout,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || '10485760')
    });
    const lines = String(res.data || '').split('\n');
    analysis.exists = true;

    let hasPermissions = false, hasGuidelines = false, hasAttr = false;
    lines.forEach(l => {
      const t = l.trim();
      if (!t || t.startsWith('#')) return;
      if (/user-agent:/i.test(t)) {
        const ua = t.split(':')[1].trim().toLowerCase();
        if (ua.includes('gpt') || ua.includes('claude') || ua.includes('perplexity')) {
          analysis.aiCrawlers.push(ua);
          hasPermissions = true;
        }
      }
      if (/guidelines|usage/i.test(t)) { hasGuidelines = true; analysis.usageGuidelines.push(t); }
      if (/attribution|citation|credit/i.test(t)) { hasAttr = true; analysis.attributionRequired = true; }
    });
    analysis.aiCrawlers = [...new Set(analysis.aiCrawlers)];
    if (analysis.exists) analysis.score += 30;
    if (hasPermissions) analysis.score += 25; else analysis.recommendations.push('Add AI crawler permissions for GPT/Claude/Perplexity.');
    if (hasGuidelines) analysis.score += 20; else analysis.issues.push('Missing AI usage guidelines.');
    if (hasAttr) analysis.score += 15; else analysis.recommendations.push('Consider attribution/citation guidance.');
    if (analysis.aiCrawlers.length > 0) analysis.score += 10;

  } catch {
    analysis.issues.push('ai.txt not found or not accessible');
    analysis.recommendations.push('Create an ai.txt file to define AI crawler permissions and expectations.');
  }
  return analysis;
}

async function analyzeOpenGraph(url) {
  const analysis = { exists: false, score: 0, maxScore: 100, issues: [], recommendations: [], tags: {}, twitterTags: {}, socialCoverage: [], hotelSpecific: {} };
  try {
    const timeout = parseInt(process.env.TIMEOUT_GENERAL || '10000');
    const res = await axios.get(url, {
      timeout,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || '10485760')
    });
    const $ = cheerio.load(res.data);
    analysis.exists = true;

    $('meta[property^="og:"]').each((i, el) => {
      const p = $(el).attr('property');
      const c = $(el).attr('content');
      if (p && c) analysis.tags[p] = c;
    });
    $('meta[name^="twitter:"]').each((i, el) => {
      const n = $(el).attr('name');
      const c = $(el).attr('content');
      if (n && c) analysis.twitterTags[n] = c;
    });

    if (Object.keys(analysis.tags).length > 0) analysis.socialCoverage.push('Facebook');
    if (Object.keys(analysis.twitterTags).length > 0) analysis.socialCoverage.push('Twitter/X');

    const requiredOg = ['og:title', 'og:description', 'og:image', 'og:url'];
    requiredOg.forEach(prop => {
      if (analysis.tags[prop]) analysis.score += 15;
      else analysis.issues.push(`Missing OpenGraph property: ${prop}`);
    });

    if (analysis.tags['og:title'] && analysis.tags['og:title'].length > 10) analysis.score += 10;
    else if (analysis.tags['og:title']) analysis.recommendations.push('Consider a longer, more descriptive og:title.');

    if (analysis.tags['og:description'] && analysis.tags['og:description'].length > 50) analysis.score += 10;
    else if (analysis.tags['og:description']) analysis.recommendations.push('Use a longer og:description (50+ chars).');

    if (analysis.tags['og:image']) {
      analysis.score += 10;
      if (analysis.tags['og:image:width'] && analysis.tags['og:image:height']) analysis.score += 5;
      else analysis.recommendations.push('Add og:image:width and og:image:height.');
      if (!isAbsolute(analysis.tags['og:image'])) analysis.recommendations.push('Use absolute URL for og:image.');
    }

    if (analysis.tags['og:type']) {
      analysis.score += 5;
      if (analysis.tags['og:type'] === 'hotel') analysis.score += 5;
    } else {
      analysis.issues.push('Missing og:type');
    }

    // hotel-specific
    ['hotel:amenity', 'hotel:checkin_time', 'hotel:checkout_time', 'hotel:price_range'].forEach(prop => {
      if (analysis.tags[prop]) { analysis.hotelSpecific[prop] = analysis.tags[prop]; analysis.score += 5; }
    });

  } catch {
    analysis.issues.push('Unable to fetch page for OpenGraph analysis.');
  }
  return analysis;
}

async function analyzeSitemap(url) {
  const analysis = { exists: false, score: 0, maxScore: 100, issues: [], recommendations: [], urlCount: 0, xmlValid: false, priorities: [], changeFreqs: [], hasImages: false };
  try {
    const sitemapUrl = new URL('/sitemap.xml', url).href;
    const timeout = parseInt(process.env.TIMEOUT_SITEMAP || '8000');
    const res = await axios.get(sitemapUrl, {
      timeout,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || '10485760')
    });
    const $ = cheerio.load(res.data, { xmlMode: true });
    analysis.exists = true;

    if ($('urlset').length > 0 || $('sitemapindex').length > 0) { analysis.xmlValid = true; analysis.score += 20; }
    else analysis.issues.push('Invalid XML: missing urlset/sitemapindex');

    const urls = $('url');
    analysis.urlCount = urls.length;
    if (urls.length > 0) {
      analysis.score += 25;
      urls.each((i, el) => {
        const $el = $(el);
        const priority = $el.find('priority').text();
        const changefreq = $el.find('changefreq').text();
        const lastmod = $el.find('lastmod').text();
        if (priority) analysis.priorities.push(priority);
        if (changefreq) analysis.changeFreqs.push(changefreq);
        if (lastmod && /^\d{4}-\d{2}-\d{2}/.test(lastmod)) analysis.score += 2;
      });
      if ($('image\\:image').length > 0 || $('image').length > 0) { analysis.hasImages = true; analysis.score += 10; }
      const ps = analysis.priorities.map(p => parseFloat(p)).filter(n => !isNaN(n));
      if (ps.length) {
        const mx = Math.max(...ps), mn = Math.min(...ps);
        if (mx === 1.0 && mn >= 0.1) analysis.score += 10;
      }
      if (analysis.changeFreqs.length > 2) analysis.score += 5;
    } else {
      analysis.issues.push('No URLs found in sitemap.');
    }
    if (urls.length < 10) analysis.recommendations.push('Add more important URLs to sitemap for better coverage.');
    if (analysis.priorities.length === 0) analysis.recommendations.push('Include <priority> to guide crawlers.');
    if (analysis.changeFreqs.length === 0) analysis.recommendations.push('Include <changefreq> where applicable.');

  } catch {
    analysis.issues.push('sitemap.xml not found or not accessible');
    analysis.recommendations.push('Create a sitemap.xml at site root.');
  }
  return analysis;
}

// -------------------------------------
// AEO / Content / Breadcrumb / Performance
// -------------------------------------
function analyzeFaqHowToSchema(allSchemas) {
  const analysis = {
    exists: false, score: 0, maxScore: 100,
    issues: [], recommendations: [],
    faqQuality: 0, howToQuality: 0, totalQuestions: 0, totalSteps: 0,
    featuredSnippetPotential: 'low',
    faqPages: []
  };

  const faqSchemas = allSchemas.filter(s => normalizeType(s['@type']).toLowerCase().includes('faqpage'));
  const howToSchemas = allSchemas.filter(s => normalizeType(s['@type']).toLowerCase().includes('howto'));

  analysis.exists = faqSchemas.length > 0 || howToSchemas.length > 0;

  // FAQ scoring
  faqSchemas.forEach(item => {
    const mainEntity = item.mainEntity;
    if (Array.isArray(mainEntity)) {
      analysis.totalQuestions += mainEntity.length;
      mainEntity.forEach(q => {
        const qname = q?.name || q?.headline || '';
        const ans = q?.acceptedAnswer?.text || '';
        if (qname && qname.length > 20) analysis.faqQuality += 10;
        if (ans) {
          const len = ans.replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
          if (len > 100) analysis.faqQuality += 15;
          else if (len > 50) analysis.faqQuality += 10;
          else analysis.recommendations.push('Provide more detailed FAQ answers (50+ words).');
        } else {
          analysis.issues.push('FAQ question missing acceptedAnswer.text');
        }
      });
    } else {
      analysis.issues.push('FAQPage without mainEntity array.');
    }
  });

  // HowTo scoring
  howToSchemas.forEach(item => {
    const steps = item.step;
    if (Array.isArray(steps)) {
      analysis.totalSteps += steps.length;
      steps.forEach(st => {
        const txt = st?.text || st?.description || '';
        if (txt) {
          const len = String(txt).replace(/<[^>]*>/g, '').trim().length;
          analysis.howToQuality += (len > 30 ? 15 : 8);
        } else {
          analysis.issues.push('HowTo step missing text/description');
        }
      });
      if (item.name && item.description) analysis.howToQuality += 10;
    } else {
      analysis.issues.push('HowTo missing step array.');
    }
  });

  // Overall score
  const totalItems = analysis.totalQuestions + analysis.totalSteps;
  if (totalItems > 0) {
    analysis.score += 30; // has content
    if (analysis.faqQuality > 50 || analysis.howToQuality > 50) analysis.score += 25;
    if (totalItems > 5) analysis.score += 20;
    else if (totalItems > 2) analysis.score += 10;
    if (analysis.totalQuestions > 0) analysis.score += 15;
    if (analysis.totalSteps > 0) analysis.score += 10;
  } else {
    analysis.recommendations.push('Add FAQ or HowTo schema with multiple entries.');
  }

  // Featured snippet potential
  if (analysis.faqQuality > 70 && analysis.totalQuestions > 3) analysis.featuredSnippetPotential = 'high';
  else if (analysis.faqQuality > 40 && analysis.totalQuestions > 1) analysis.featuredSnippetPotential = 'medium';

  if (faqSchemas.length === 0) analysis.recommendations.push('Add FAQPage schema for common questions.');

  return analysis;
}

function analyzeBreadcrumbs($, pageUrl) {
  const analysis = { exists: false, score: 0, maxScore: 100, issues: [], recommendations: [], breadcrumbType: null, depth: 0, structured: false, accurate: false };

  // JSON-LD breadcrumbs
  let jsonLdBreadcrumbs = null;
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const content = cleanJsonLikeString($(el).html() || '');
      const parsed = JSON.parse(content);
      const nodes = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
      nodes.forEach(n => {
        if (n && n['@type'] === 'BreadcrumbList') jsonLdBreadcrumbs = n;
      });
    } catch {}
  });

  if (jsonLdBreadcrumbs) {
    analysis.exists = true;
    analysis.breadcrumbType = 'JSON-LD';
    analysis.structured = true;
    const items = jsonLdBreadcrumbs.itemListElement || [];
    analysis.depth = items.length;
    if (items.length > 0) analysis.score += 40;
    if (items.length >= 3) analysis.score += 15;
    items.forEach((it, idx) => {
      if (it.position === idx + 1 && it.name && (it.item || it.item?.['@id'])) analysis.score += 5;
      else analysis.issues.push(`Breadcrumb item ${idx + 1} missing position/name/item`);
    });
    analysis.accurate = true; // heuristic; real path compare would be heavier
    analysis.score += 10;
  }

  // Microdata/HTML breadcrumbs fallback
  const micro = $('[itemtype*="BreadcrumbList"], nav[aria-label*="breadcrumb"], .breadcrumb, [class*="breadcrumb"]');
  if (!analysis.exists && micro.length > 0) {
    analysis.exists = true;
    analysis.breadcrumbType = 'Microdata/HTML';
    analysis.depth = micro.find('li,[itemprop="itemListElement"]').length;
    analysis.score += 35;
    if (analysis.depth >= 3) analysis.score += 10;
  }

  if (!analysis.exists) {
    analysis.issues.push('No breadcrumb navigation found.');
    analysis.recommendations.push('Add JSON-LD BreadcrumbList for better SEO.');
  }
  return analysis;
}

function analyzeContentStructure($) {
  const analysis = { score: 0, maxScore: 100, issues: [], recommendations: [], headerHierarchy: {}, paragraphStats: {}, contentDensity: 'unknown', readabilityScore: 0 };

  const headers = {};
  for (let i = 1; i <= 6; i++) {
    const count = $(`h${i}`).length;
    headers[`h${i}`] = count;
    if (count > 0) analysis.score += 5;
  }
  if (headers.h1 === 1) analysis.score += 15;
  else if (headers.h1 === 0) analysis.issues.push('Missing H1 tag.');
  else analysis.issues.push('Multiple H1 tags detected.');

  if (headers.h1 > 0 && headers.h2 > 0) analysis.score += 10;
  if (headers.h2 > 0 && headers.h3 > 0) analysis.score += 5;
  analysis.headerHierarchy = headers;

  const paragraphs = $('p').map((i, p) => $(p).text().trim()).get().filter(Boolean);
  const lengths = paragraphs.map(t => t.length);
  const avg = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0;
  analysis.paragraphStats = {
    count: paragraphs.length,
    averageLength: avg,
    minLength: lengths.length ? Math.min(...lengths) : 0,
    maxLength: lengths.length ? Math.max(...lengths) : 0
  };
  if (paragraphs.length > 0) analysis.score += 10;
  if (avg > 100) analysis.score += 10; else if (avg < 50) analysis.recommendations.push('Consider longer paragraphs (100+ chars).');

  const lists = $('ul,ol');
  if (lists.length > 0) {
    analysis.score += 10;
    lists.each((i, el) => { if ($(el).find('li').length > 2) analysis.score += 5; });
  } else {
    analysis.recommendations.push('Add bullet/numbered lists where helpful.');
  }

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const len = bodyText.length;
  if (len > 1000) { analysis.contentDensity = 'comprehensive'; analysis.score += 15; }
  else if (len > 500) { analysis.contentDensity = 'good'; analysis.score += 10; }
  else if (len > 200) { analysis.contentDensity = 'basic'; analysis.score += 5; }
  else analysis.issues.push('Very short content on page.');

  analysis.readabilityScore = fleschKincaidReadingEase(bodyText);
  if (analysis.readabilityScore >= 70) analysis.score += 10;
  else if (analysis.readabilityScore >= 50) analysis.score += 5;

  return analysis;
}

function analyzePerformance($, html, url) {
  const analysis = {
    score: 0, maxScore: 100, issues: [], recommendations: [],
    coreWebVitals: {
      LCP: { value: '0s', score: 0, status: 'unknown' },
      FID: { value: '0ms', score: 0, status: 'unknown' },
      CLS: { value: '0', score: 0, status: 'unknown' }
    },
    pageSpeed: { loadTime: 'unknown', size: `${Math.round((html.length || 0) / 1024)}KB`, requests: 0, score: 0 },
    mobileFriendly: false,
    technicalSEO: { brokenLinks: 0, redirects: 0, statusCodes: {}, score: 0, canonicalFound: false, internalLinks: 0 }
  };

  const images = $('img').length;
  const scripts = $('script').length;
  const styles = $('link[rel="stylesheet"]').length;
  analysis.pageSpeed.requests = images + scripts + styles;

  const size = html.length;
  if (size < 50000) { analysis.pageSpeed.score += 25; analysis.pageSpeed.loadTime = '< 1s'; }
  else if (size < 100000) { analysis.pageSpeed.score += 15; analysis.pageSpeed.loadTime = '1-2s'; }
  else if (size < 200000) { analysis.pageSpeed.score += 10; analysis.pageSpeed.loadTime = '2-3s'; }
  else { analysis.pageSpeed.loadTime = '> 3s'; analysis.issues.push('Large HTML size; consider compression/trim.'); }

  if (analysis.pageSpeed.requests < 20) analysis.pageSpeed.score += 25;
  else if (analysis.pageSpeed.requests < 50) analysis.pageSpeed.score += 15;
  else if (analysis.pageSpeed.requests < 100) analysis.pageSpeed.score += 5;
  else analysis.issues.push('Too many resources; consider lazy-load and bundling.');

  // LCP estimate
  if (images === 0) { analysis.coreWebVitals.LCP = { value: '1.2s', score: 90, status: 'good' }; analysis.score += 15; }
  else if (images <= 5) { analysis.coreWebVitals.LCP = { value: '2.1s', score: 75, status: 'needs-improvement' }; analysis.score += 10; }
  else { analysis.coreWebVitals.LCP = { value: '3.8s', score: 40, status: 'poor' }; analysis.issues.push('Many images may worsen LCP; optimize.'); }

  // FID estimate
  if (scripts <= 3) { analysis.coreWebVitals.FID = { value: '45ms', score: 95, status: 'good' }; analysis.score += 15; }
  else if (scripts <= 8) { analysis.coreWebVitals.FID = { value: '120ms', score: 65, status: 'needs-improvement' }; analysis.score += 8; }
  else { analysis.coreWebVitals.FID = { value: '280ms', score: 30, status: 'poor' }; analysis.issues.push('Heavy JS can worsen FID; defer/split.'); }

  // CLS estimate
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const fixedDims = $('img[width][height], [style*="width"][style*="height"]').length;
  if (hasViewport && fixedDims > 0) { analysis.coreWebVitals.CLS = { value: '0.05', score: 95, status: 'good' }; analysis.score += 15; }
  else if (hasViewport) { analysis.coreWebVitals.CLS = { value: '0.15', score: 65, status: 'needs-improvement' }; analysis.score += 8; }
  else { analysis.coreWebVitals.CLS = { value: '0.35', score: 20, status: 'poor' }; analysis.issues.push('Missing viewport meta; critical for mobile.'); }

  analysis.mobileFriendly = hasViewport;
  if (analysis.mobileFriendly) { analysis.score += 15; analysis.technicalSEO.score += 20; }
  else analysis.recommendations.push('Add <meta name="viewport" content="width=device-width, initial-scale=1.0">');

  if ($('meta[name="theme-color"]').length > 0) { analysis.score += 5; analysis.technicalSEO.score += 10; }
  if ($('link[rel="manifest"]').length > 0) { analysis.score += 5; analysis.technicalSEO.score += 10; }

  // Structured data density
  const jsonLdCount = $('script[type="application/ld+json"]').length;
  const microCount = $('[itemscope]').length;
  const rdfaCount = $('[typeof]').length;
  if (jsonLdCount > 0 || microCount > 0 || rdfaCount > 0) { analysis.technicalSEO.score += 20; analysis.score += 10; }
  else analysis.issues.push('No structured data found.');

  // Suggestions
  if (scripts > 5) analysis.recommendations.push('Reduce JS files or split/defer to improve interactivity.');
  if (styles > 3) analysis.recommendations.push('Combine CSS or use critical CSS.');
  if (images > 10) analysis.recommendations.push('Use compression and lazy-loading for images.');

  return analysis;
}

// -------------------------------------
// Meta consistency / Canonical / Crawlability
// -------------------------------------
function analyzeMetaConsistency($, pageSchemas) {
  const res = { score: 0, maxScore: 100, issues: [], recommendations: [], details: {} };
  const title = $('title').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';

  // Attempt to find primary schema "name"
  const primary = pageSchemas.find(s => /Hotel|LocalBusiness|Organization|Product|Article/i.test(String(s['@type'])));
  const schemaName = primary?.name || '';

  res.details = { title, metaDesc, ogTitle, ogDesc, schemaName };

  let points = 0;
  if (title && schemaName && title.toLowerCase().includes(schemaName.toLowerCase())) points += 25;
  if (metaDesc && ogDesc && metaDesc.slice(0, 60) === ogDesc.slice(0, 60)) points += 15; // similar starts
  if (ogTitle && title && ogTitle.slice(0, 50) === title.slice(0, 50)) points += 15;

  res.score = points;
  if (!schemaName) res.recommendations.push('Primary entity missing a clear name.');
  if (!metaDesc) res.recommendations.push('Add <meta name="description">');
  if (!ogTitle || !ogDesc) res.recommendations.push('Add OpenGraph title/description for consistency.');
  return res;
}

function analyzeCanonicalOgAlignment($, pageUrl) {
  const res = { score: 0, maxScore: 100, issues: [], recommendations: [], details: {} };
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const ogUrl = $('meta[property="og:url"]').attr('content') || '';

  const resolvedCanonical = canonical ? absolutize(canonical, pageUrl) : '';
  const resolvedOg = ogUrl ? absolutize(ogUrl, pageUrl) : '';

  res.details = { canonical: resolvedCanonical, ogUrl: resolvedOg, pageUrl };

  let points = 0;
  if (resolvedCanonical && resolvedOg && resolvedCanonical === resolvedOg) points += 40;
  if (resolvedCanonical && resolvedCanonical.split('#')[0] === pageUrl.split('#')[0]) points += 30;
  if (!resolvedCanonical) res.recommendations.push('Add a rel="canonical" link.');
  if (!resolvedOg) res.recommendations.push('Add og:url for clarity.');
  res.score = points;
  return res;
}

function analyzeCrawlability($, pageUrl) {
  const res = { score: 0, maxScore: 100, issues: [], recommendations: [], details: {} };
  const robotsMeta = $('meta[name="robots"]').attr('content') || '';
  const isNoIndex = /noindex/i.test(robotsMeta);
  const isNoFollow = /nofollow/i.test(robotsMeta);

  const anchors = $('a[href]').map((i, a) => $(a).attr('href')).get();
  const internal = anchors.filter(h => h && !/^https?:\/\//i.test(h)).length;
  const nofollowLinks = $('a[rel*="nofollow"]').length;

  res.details = { robotsMeta, internalLinks: internal, nofollowLinks };

  let points = 50; // start from decent
  if (isNoIndex) { res.issues.push('Page is noindex.'); points -= 40; }
  if (isNoFollow) { res.recommendations.push('Avoid nofollow on important pages.'); points -= 10; }
  if (internal === 0) res.recommendations.push('Add internal links to important pages.');

  res.score = Math.max(0, points);
  return res;
}

// -------------------------------------
// Rich Results Eligibility (light heuristic)
// -------------------------------------
function richResultsEligibility(allSchemas, pageUrl) {
  const eligibility = [];

  function push(name, ok, reasons = []) {
    eligibility.push({ feature: name, eligible: ok, reasons });
  }

  // WebSite SearchAction
  const site = allSchemas.find(s => /website/i.test(String(s['@type'])));
  if (site) {
    const pa = site.potentialAction;
    const ok = pa && /SearchAction/i.test(String(pa['@type'])) && pa.target && String(pa['query-input'] || pa['queryInput']).includes('required');
    push('Sitelinks Searchbox (WebSite + SearchAction)', !!ok, ok ? [] : ['Missing/invalid SearchAction target or query-input']);
  }

  // Logo/Organization
  const org = allSchemas.find(s => /Organization/i.test(String(s['@type'])));
  if (org) {
    const ok = !!org.logo && !!org.url;
    push('Organization Logo', ok, ok ? [] : ['Add Organization.logo and Organization.url']);
  }

  // LocalBusiness contactPoint
  const lb = allSchemas.find(s => /LocalBusiness|Hotel|LodgingBusiness/i.test(String(s['@type'])));
  if (lb) {
    const cp = lb.contactPoint;
    const ok = !!cp;
    push('LocalBusiness ContactPoint', ok, ok ? [] : ['Add Organization.contactPoint (phone, contactType, availableLanguage)']);
  }

  // VideoObject
  const video = allSchemas.find(s => /VideoObject/i.test(String(s['@type'])));
  if (video) {
    const ok = !!video.name && !!video.thumbnailUrl && !!video.uploadDate;
    const reasons = [];
    if (!video.name) reasons.push('name');
    if (!video.thumbnailUrl) reasons.push('thumbnailUrl');
    if (!video.uploadDate) reasons.push('uploadDate');
    push('Video Rich Result', ok, ok ? [] : reasons.map(r => `Missing ${r}`));
  }

  // ImageObject
  const image = allSchemas.find(s => /ImageObject/i.test(String(s['@type'])));
  if (image) {
    const ok = !!image.url;
    push('Image Rich Result Signals', ok, ok ? [] : ['Add ImageObject.url']);
  }

  // QAPage
  const qa = allSchemas.find(s => /QAPage/i.test(String(s['@type'])));
  if (qa) {
    const ok = Array.isArray(qa.mainEntity) && qa.mainEntity.length > 0;
    push('Q&A Rich Result', ok, ok ? [] : ['QAPage.mainEntity must be a non-empty array']);
  }

  // Article
  const article = allSchemas.find(s => /Article|BlogPosting|NewsArticle/i.test(String(s['@type'])));
  if (article) {
    const ok = !!article.headline && !!article.image && !!article.datePublished && !!article.author;
    const miss = [];
    if (!article.headline) miss.push('headline');
    if (!article.image) miss.push('image');
    if (!article.datePublished) miss.push('datePublished');
    if (!article.author) miss.push('author');
    push('Article Rich Result', ok, ok ? [] : miss.map(m => `Missing ${m}`));
  }

  // ItemList
  const list = allSchemas.find(s => /ItemList/i.test(String(s['@type'])));
  if (list) {
    const ok = Array.isArray(list.itemListElement) && list.itemListElement.length > 0;
    push('ItemList (collections/carousels)', ok, ok ? [] : ['ItemList.itemListElement should be non-empty']);
  }

  // Product
  const prod = allSchemas.find(s => /Product/i.test(String(s['@type'])));
  if (prod) {
    const hasOffer = !!prod.offers;
    const reasons = [];
    if (!hasOffer) reasons.push('offers');
    push('Product Rich Results / Listings', hasOffer, hasOffer ? [] : reasons.map(r => `Missing ${r}`));
  }

  return eligibility;
}

// -------------------------------------
// API Route
// -------------------------------------
app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    let pageUrl;
    try { pageUrl = new URL(url).href; } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

    // Try JavaScript rendering first if enabled
    let html = null;
    let finalUrl = pageUrl;
    let renderMethod = 'axios';

    const jsRenderResult = await renderPageWithJavaScript(pageUrl);
    if (jsRenderResult && jsRenderResult.success) {
      html = jsRenderResult.html;
      finalUrl = pageUrl; // Puppeteer handles redirects internally
      renderMethod = 'puppeteer';
    } else {
      // Fallback to axios with enhanced bot bypass
      const timeout = parseInt(process.env.TIMEOUT_PAGE || '15000');
      const maxContentLength = parseInt(process.env.MAX_CONTENT_LENGTH || '10485760');

      // Enhanced headers for bot bypass (if enabled)
      const enhancedBypass = process.env.ENABLE_ENHANCED_BOT_BYPASS === 'true';
      const headers = enhancedBypass ? {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-site': 'none',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-user': '?1',
        'sec-fetch-dest': 'document',
        'upgrade-insecure-requests': '1',
        'dnt': '1',
        'cache-control': 'max-age=0'
      } : {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.8'
      };

      const response = await axios.get(pageUrl, {
        timeout,
        maxContentLength,
        maxBodyLength: maxContentLength,
        headers,
        maxRedirects: 5
      });
      finalUrl = response.request?.res?.responseUrl || pageUrl;
      html = response.data;
      renderMethod = 'axios';
    }

    if (!html || typeof html !== 'string') return res.status(400).json({ error: 'Invalid HTML content.' });

    let $;
    try { $ = cheerio.load(html); } catch { return res.status(400).json({ error: 'Unable to parse HTML.' }); }

    // Extract schemas
    const jsonLd = extractJsonLd($);
    const microdata = extractMicrodata($, finalUrl);
    const rdfa = extractRdfa($, finalUrl);

    // Merge all schemas for cross-analyses
    const allSchemas = [...jsonLd, ...microdata, ...rdfa];

    // Analyses
    const robotsAnalysis = await analyzeRobotsTxt(finalUrl);
    const llmAnalysis = await analyzeLlmTxt(finalUrl);
    const aiAnalysis = await analyzeAiTxt(finalUrl);
    const openGraphAnalysis = await analyzeOpenGraph(finalUrl);
    const sitemapAnalysis = await analyzeSitemap(finalUrl);
    const faqHowToAnalysis = analyzeFaqHowToSchema(allSchemas);
    const breadcrumbAnalysis = analyzeBreadcrumbs($, finalUrl);
    const contentStructureAnalysis = analyzeContentStructure($);
    const performanceAnalysis = analyzePerformance($, html, finalUrl);
    const metaConsistency = analyzeMetaConsistency($, allSchemas);
    const canonicalOgAlignment = analyzeCanonicalOgAlignment($, finalUrl);
    const crawlability = analyzeCrawlability($, finalUrl);
    const richEligibility = richResultsEligibility(allSchemas, finalUrl);

    // Validation for target schemas
    const matched = [];
    allSchemas.forEach((schema, index) => {
      const schemaType = normalizeType(schema['@type']);
      if (schemaType && matchesTargetSchemas(schemaType)) {
        const primaryType = schemaType.split(',')[0].trim(); // if multiple, pick first for rules
        const validation = validateSchema(schema, primaryType);

        // Detect non-standard properties
        const nonStandardWarnings = detectNonStandardProperties(schema, primaryType);
        if (nonStandardWarnings.length > 0) {
          validation.nonStandardProperties = nonStandardWarnings;
          validation.recommendations.push({
            message: `Found ${nonStandardWarnings.length} non-standard property/properties. These may not be recognized by search engines.`,
            type: 'non-standard-summary',
            details: nonStandardWarnings
          });
        }

        // Analyze HTML content in text fields
        const htmlContentWarnings = analyzeHtmlContent(schema, primaryType);
        if (htmlContentWarnings.length > 0) {
          validation.htmlContentWarnings = htmlContentWarnings;
          validation.recommendations.push({
            message: `Found HTML tags in ${htmlContentWarnings.length} text field(s). Consider using plain text for better compatibility.`,
            type: 'html-content-summary',
            details: htmlContentWarnings
          });
        }

        // Check date freshness
        const dateFreshnessWarnings = checkDateFreshness(schema);
        if (dateFreshnessWarnings.length > 0) {
          validation.dateFreshnessWarnings = dateFreshnessWarnings;
          const oldDates = dateFreshnessWarnings.filter(w => w.severity === 'warning').length;
          if (oldDates > 0) {
            validation.recommendations.push({
              message: `Found ${oldDates} date(s) over 2 years old. Update content dates for better freshness signals.`,
              type: 'date-freshness-summary',
              details: dateFreshnessWarnings
            });
          }
        }

        matched.push({
          type: schemaType,
          sourceIndex: index,
          source: jsonLd.includes(schema) ? 'JSON-LD' : (microdata.includes(schema) ? 'Microdata' : 'RDFa'),
          data: schema,
          validation
        });
      }
    });

    // Overall validation score
    const totalValidationScore = matched.reduce((s, m) => s + (m.validation?.score || 0), 0);
    const totalMaxScore = matched.reduce((s, m) => s + (m.validation?.maxScore || 0), 0);
    const schemaCount = matched.length;
    const averageValidationScore = schemaCount ? Math.round(totalValidationScore / schemaCount) : 0;

    return res.json({
      url: finalUrl,
      renderMethod, // 'puppeteer' or 'axios'
      jsonLd,
      microdata,
      rdfa,
      allSchemasCount: allSchemas.length,
      matched,
      validation: {
        averageScore: averageValidationScore,
        totalScore: totalValidationScore,
        totalMaxScore: totalMaxScore,
        schemaCount
      },
      // SEO/AEO/GEO & infra
      robotsAnalysis,
      llmAnalysis,
      aiAnalysis,
      openGraphAnalysis,
      sitemapAnalysis,
      faqHowToAnalysis,
      breadcrumbAnalysis,
      contentStructureAnalysis,
      performanceAnalysis,
      metaConsistency,
      canonicalOgAlignment,
      crawlability,
      richEligibility
    });
  } catch (error) {
    console.error('API Analysis error:', error);

    // Sanitize error messages for production
    let userMessage = 'An error occurred while analyzing the URL.';

    if (error.code === 'ENOTFOUND') {
      userMessage = 'Unable to reach the URL. Please check the domain name.';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      userMessage = 'Request timed out. The website may be slow or unreachable.';
    } else if (error.response?.status === 403) {
      userMessage = 'Access forbidden. The website may be blocking automated requests.';
    } else if (error.response?.status === 404) {
      userMessage = 'Page not found. Please check the URL.';
    } else if (error.response?.status === 429) {
      userMessage = 'Too many requests to the target site. Please try again later.';
    } else if (error.response?.status >= 500) {
      userMessage = 'The target website is experiencing server errors.';
    } else if (NODE_ENV === 'development') {
      userMessage = `Development error: ${error.message}`;
    }

    return res.status(500).json({ error: userMessage });
  }
});

// -------------------------------------
// Serve UI
// -------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// For local run:
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

// Export for serverless, tests, etc.
module.exports = app;
