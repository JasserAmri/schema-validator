// utils/stringUtils.js
// Pure string utility functions

function safeStr(x) {
  return (typeof x === 'string') ? x : '';
}

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

module.exports = {
  safeStr,
  cleanJsonLikeString
};
