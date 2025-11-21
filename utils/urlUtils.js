// utils/urlUtils.js
// Pure URL utility functions

function isValidUrl(value) {
  try { new URL(value); return true; } catch { return false; }
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

module.exports = {
  isValidUrl,
  isAbsolute,
  absolutize
};
