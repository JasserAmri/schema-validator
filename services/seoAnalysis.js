// services/seoAnalysis.js
// SEO/AEO file analyzers: robots.txt, llms.txt, ai.txt, OpenGraph, sitemap.xml

const axios = require('axios');
const cheerio = require('cheerio');
const { isAbsolute } = require('../utils/urlUtils');

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
    if (/Disallow:\s*\/\s*$/i.test(content)) analysis.recommendations.push('robots.txt blocks everything - ensure that is intended.');

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

module.exports = {
  analyzeRobotsTxt,
  analyzeLlmTxt,
  analyzeAiTxt,
  analyzeOpenGraph,
  analyzeSitemap
};
