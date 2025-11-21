// utils/dateUtils.js
// Pure date/time utility functions

function isValidDate(value) {
  // ISO-ish date test
  return /^\d{4}-\d{2}-\d{2}([Tt ][\d:.\-+Zz]+)?$/.test(String(value));
}

function isValidTime(value) {
  const s = String(value);
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s) || /^\d{2}:\d{2}:\d{2}$/.test(s);
}

module.exports = {
  isValidDate,
  isValidTime
};
