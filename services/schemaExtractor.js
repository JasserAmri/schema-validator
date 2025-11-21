// services/schemaExtractor.js
// Extract schemas from HTML (JSON-LD, Microdata, RDFa)

const { cleanJsonLikeString } = require('../utils/stringUtils');
const { normalizeSchemaObject } = require('../utils/schemaUtils');
const { absolutize } = require('../utils/urlUtils');
const { textFrom } = require('../utils/cheerioUtils');

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

module.exports = {
  extractJsonLd,
  extractMicrodata,
  extractRdfa
};
