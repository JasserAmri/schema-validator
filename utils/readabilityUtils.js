// utils/readabilityUtils.js
// Pure-JS Flesch-Kincaid readability helpers

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

module.exports = {
  countSyllables,
  countWords,
  countSentences,
  fleschKincaidReadingEase
};
