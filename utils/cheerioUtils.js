// utils/cheerioUtils.js
// Cheerio-specific utility functions

function textFrom($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim();
}

module.exports = {
  textFrom
};
