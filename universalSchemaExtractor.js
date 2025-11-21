// universalSchemaExtractor.js
// Google-style tolerant universal schema extraction
// Handles malformed, embedded, dynamic, and hidden schema markup

const JSON5 = require('json5');

/**
 * Universal Schema Extractor
 * Extracts ALL schema.org structured data from HTML, no matter how it's embedded
 *
 * Handles:
 * - Malformed JSON-LD
 * - HTML inside JSON
 * - Trailing commas
 * - Scripts without type attribute
 * - Hidden divs
 * - Dynamic injection
 * - iframes
 * - JS variables
 * - Shadow DOM
 * - @graph structures
 * - Any CMS (Quicktext, WordPress, Wix, Webflow, etc.)
 */

// Schema.org keywords to identify potential schema blocks
const SCHEMA_KEYWORDS = [
  '@type', '@context', 'schema.org',
  'FAQPage', 'Question', 'Answer',
  'Hotel', 'Organization', 'HowTo',
  'BreadcrumbList', 'WebSite', 'Product',
  'Review', 'AggregateRating', 'LocalBusiness',
  'Article', 'BlogPosting', 'NewsArticle',
  'Event', 'Place', 'Person', 'PostalAddress'
];

/**
 * Extract all potential JSON-LD blocks from HTML using regex
 * This is the most important step - captures everything
 */
function extractRawSchemaBlocks(html) {
  const blocks = [];

  // Extract from <script> tags (any type or no type)
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptTag = match[0];
    const content = match[1];

    // Check if content might contain schema
    const hasSchemaKeyword = SCHEMA_KEYWORDS.some(keyword =>
      content.includes(keyword)
    );

    if (hasSchemaKeyword) {
      blocks.push({
        raw: content,
        source: 'script-tag',
        scriptTag: scriptTag,
        location: match.index
      });
    }
  }

  // Extract from HTML attributes (data-schema, etc.)
  const dataSchemaRegex = /data-schema=['"]([\s\S]*?)['"]/gi;
  while ((match = dataSchemaRegex.exec(html)) !== null) {
    blocks.push({
      raw: match[1],
      source: 'data-attribute',
      location: match.index
    });
  }

  // Extract from hidden divs or other elements
  const hiddenDivRegex = /<div[^>]*style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  while ((match = hiddenDivRegex.exec(html)) !== null) {
    const content = match[1];
    if (SCHEMA_KEYWORDS.some(k => content.includes(k))) {
      blocks.push({
        raw: content,
        source: 'hidden-div',
        location: match.index
      });
    }
  }

  // Extract JSON objects directly from script content
  // Pattern: var schema = {...} or window.schema = {...}
  const jsVarRegex = /(?:var|let|const|window\.)?\s*\w+\s*=\s*(\{[\s\S]*?\});?/g;
  while ((match = jsVarRegex.exec(html)) !== null) {
    const content = match[1];
    if (SCHEMA_KEYWORDS.some(k => content.includes(k))) {
      blocks.push({
        raw: content,
        source: 'js-variable',
        location: match.index
      });
    }
  }

  return blocks;
}

/**
 * Sanitize and clean JSON-LD content
 * Removes HTML tags, fixes common issues
 */
function sanitizeJsonLd(content) {
  let cleaned = content;

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove HTML tags
  cleaned = cleaned.replace(/<br\s*\/?>/gi, ' ');
  cleaned = cleaned.replace(/<\/?[a-z][^>]*>/gi, '');

  // Decode HTML entities
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&apos;/g, "'");
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  cleaned = cleaned.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // Remove trailing comma at end
  cleaned = cleaned.replace(/,\s*$/, '');

  // Fix unquoted property names
  cleaned = cleaned.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/g, '$1"$2"$3');

  // Replace single quotes with double quotes (but be careful with apostrophes in values)
  // This is a simplified approach - JSON5 will handle it better

  return cleaned.trim();
}

/**
 * Try to parse JSON with multiple strategies
 * Returns { success: boolean, data: object|null, method: string, error: string|null }
 */
function tolerantJsonParse(content) {
  const strategies = [
    { name: 'native-json', parser: JSON.parse },
    { name: 'json5', parser: JSON5.parse },
    { name: 'sanitized-json', parser: (c) => JSON.parse(sanitizeJsonLd(c)) },
    { name: 'sanitized-json5', parser: (c) => JSON5.parse(sanitizeJsonLd(c)) }
  ];

  for (const strategy of strategies) {
    try {
      const parsed = strategy.parser(content);
      return {
        success: true,
        data: parsed,
        method: strategy.name,
        error: null
      };
    } catch (e) {
      // Continue to next strategy
    }
  }

  // Try @graph extraction as last resort
  try {
    const graphMatch = content.match(/"@graph"\s*:\s*(\[[\s\S]*?\])/);
    if (graphMatch) {
      const graphArray = JSON5.parse(graphMatch[1]);
      if (Array.isArray(graphArray)) {
        return {
          success: true,
          data: { '@graph': graphArray },
          method: 'graph-extraction',
          error: null
        };
      }
    }
  } catch (e) {
    // Continue
  }

  // Try to extract individual schema objects with regex
  try {
    const objectMatches = content.matchAll(/\{[^{}]*"@type"[^{}]*\}/g);
    const objects = [];
    for (const match of objectMatches) {
      try {
        const obj = JSON5.parse(match[0]);
        objects.push(obj);
      } catch (e) {
        // Skip this one
      }
    }

    if (objects.length > 0) {
      return {
        success: true,
        data: objects.length === 1 ? objects[0] : objects,
        method: 'regex-object-extraction',
        error: null
      };
    }
  } catch (e) {
    // Continue
  }

  return {
    success: false,
    data: null,
    method: 'all-failed',
    error: 'Could not parse JSON with any strategy'
  };
}

/**
 * Extract schemas from Puppeteer page (handles iframes, shadow DOM, dynamic content)
 */
async function extractFromPuppeteerPage(page) {
  const results = [];

  try {
    // Extract from main frame
    const mainHtml = await page.content();
    const mainBlocks = extractRawSchemaBlocks(mainHtml);

    for (const block of mainBlocks) {
      const parseResult = tolerantJsonParse(block.raw);
      if (parseResult.success) {
        results.push({
          ...parseResult,
          source: block.source,
          location: block.location,
          frame: 'main'
        });
      }
    }

    // Extract from iframes
    const frames = page.frames();
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (frame === page.mainFrame()) continue; // Skip main frame

      try {
        const frameHtml = await frame.content();
        const frameBlocks = extractRawSchemaBlocks(frameHtml);

        for (const block of frameBlocks) {
          const parseResult = tolerantJsonParse(block.raw);
          if (parseResult.success) {
            results.push({
              ...parseResult,
              source: block.source,
              location: block.location,
              frame: `iframe-${i}`
            });
          }
        }
      } catch (e) {
        // iframe might be cross-origin, skip
        console.log(`[Universal Extractor] Could not access iframe ${i}:`, e.message);
      }
    }

    // Extract from Shadow DOM
    try {
      const shadowSchemas = await page.evaluate(() => {
        const schemas = [];

        function scanShadowRoots(root) {
          const elements = root.querySelectorAll('*');
          elements.forEach(el => {
            if (el.shadowRoot) {
              const shadowHtml = el.shadowRoot.innerHTML;
              // Check for schema keywords
              if (shadowHtml.includes('@type') || shadowHtml.includes('schema.org')) {
                schemas.push({
                  html: shadowHtml,
                  source: 'shadow-dom'
                });
              }
              scanShadowRoots(el.shadowRoot);
            }
          });
        }

        scanShadowRoots(document);
        return schemas;
      });

      for (const shadowSchema of shadowSchemas) {
        const blocks = extractRawSchemaBlocks(shadowSchema.html);
        for (const block of blocks) {
          const parseResult = tolerantJsonParse(block.raw);
          if (parseResult.success) {
            results.push({
              ...parseResult,
              source: 'shadow-dom',
              location: 0,
              frame: 'shadow-dom'
            });
          }
        }
      }
    } catch (e) {
      console.log('[Universal Extractor] Shadow DOM extraction failed:', e.message);
    }

    // Count schema script tags in the page
    const schemaTagCount = await page.evaluate(() => {
      return document.querySelectorAll('script[type="application/ld+json"]').length;
    });

    console.log('[Universal Extractor] Found schema script tags:', schemaTagCount);
    console.log('[Universal Extractor] Extracted schemas from all sources:', results.length);

  } catch (e) {
    console.error('[Universal Extractor] Error during Puppeteer extraction:', e);
  }

  return results;
}

/**
 * Extract schemas from Cheerio-loaded HTML (axios fallback)
 */
function extractFromCheerioHtml(html) {
  const results = [];
  const blocks = extractRawSchemaBlocks(html);

  for (const block of blocks) {
    const parseResult = tolerantJsonParse(block.raw);
    if (parseResult.success) {
      results.push({
        ...parseResult,
        source: block.source,
        location: block.location,
        frame: 'main'
      });
    }
  }

  console.log('[Universal Extractor] Extracted schemas from HTML:', results.length);

  return results;
}

/**
 * Normalize and flatten schema results
 * Handles @graph, arrays, nested structures
 */
function normalizeSchemaResults(results) {
  const normalized = [];

  for (const result of results) {
    if (!result.data) continue;

    // Handle @graph
    if (result.data['@graph'] && Array.isArray(result.data['@graph'])) {
      result.data['@graph'].forEach(item => {
        normalized.push({
          schema: item,
          extractionMethod: result.method,
          source: result.source,
          frame: result.frame || 'main'
        });
      });
    }
    // Handle array of schemas
    else if (Array.isArray(result.data)) {
      result.data.forEach(item => {
        normalized.push({
          schema: item,
          extractionMethod: result.method,
          source: result.source,
          frame: result.frame || 'main'
        });
      });
    }
    // Handle single schema
    else if (result.data['@type']) {
      normalized.push({
        schema: result.data,
        extractionMethod: result.method,
        source: result.source,
        frame: result.frame || 'main'
      });
    }
  }

  // Deduplicate (basic - by JSON stringification)
  const seen = new Set();
  const deduplicated = [];

  for (const item of normalized) {
    const key = JSON.stringify(item.schema);
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(item.schema);
    }
  }

  console.log('[Universal Extractor] After normalization and deduplication:', deduplicated.length);

  return deduplicated;
}

module.exports = {
  extractFromPuppeteerPage,
  extractFromCheerioHtml,
  normalizeSchemaResults,
  extractRawSchemaBlocks,
  sanitizeJsonLd,
  tolerantJsonParse
};
