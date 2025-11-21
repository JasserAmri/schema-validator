// utils/schemaUtils.js
// Schema.org utility functions

const TARGET_SCHEMAS = require('../constants/schemas');

function normalizeType(raw) {
  if (!raw) return '';
  if (Array.isArray(raw)) return raw.map(s => String(s)).join(',');
  return String(raw);
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

function matchesTargetSchemas(schemaType) {
  const t = String(schemaType || '');
  return TARGET_SCHEMAS.some(target =>
    t.toLowerCase().includes(target.toLowerCase()) ||
    target.toLowerCase().includes(t.toLowerCase())
  );
}

module.exports = {
  normalizeType,
  normalizeSchemaObject,
  matchesTargetSchemas
};
