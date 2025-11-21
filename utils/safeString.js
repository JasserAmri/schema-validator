// utils/safeString.js
// Safe string normalizer for schema fields that may be strings, arrays, objects, or undefined

function safeString(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value))
    return value
      .map(v => (typeof v === "string" ? v : ""))
      .join(" ")
      .trim();
  if (value && typeof value === "object") {
    const first = Object.values(value)[0];
    return typeof first === "string" ? first.trim() : "";
  }
  return "";
}

module.exports = { safeString };
