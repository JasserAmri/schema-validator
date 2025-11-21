// services/richResults.js
// Google Rich Results eligibility determination

function richResultsEligibility(allSchemas, pageUrl) {
  const eligibility = [];

  function push(name, ok, reasons = []) {
    eligibility.push({ feature: name, eligible: ok, reasons });
  }

  // WebSite SearchAction
  const site = allSchemas.find(s => /website/i.test(String(s['@type'])));
  if (site) {
    const pa = site.potentialAction;
    const ok = pa && /SearchAction/i.test(String(pa['@type'])) && pa.target && String(pa['query-input'] || pa['queryInput']).includes('required');
    push('Sitelinks Searchbox (WebSite + SearchAction)', !!ok, ok ? [] : ['Missing/invalid SearchAction target or query-input']);
  }

  // Logo/Organization
  const org = allSchemas.find(s => /Organization/i.test(String(s['@type'])));
  if (org) {
    const ok = !!org.logo && !!org.url;
    push('Organization Logo', ok, ok ? [] : ['Add Organization.logo and Organization.url']);
  }

  // LocalBusiness contactPoint
  const lb = allSchemas.find(s => /LocalBusiness|Hotel|LodgingBusiness/i.test(String(s['@type'])));
  if (lb) {
    const cp = lb.contactPoint;
    const ok = !!cp;
    push('LocalBusiness ContactPoint', ok, ok ? [] : ['Add Organization.contactPoint (phone, contactType, availableLanguage)']);
  }

  // VideoObject
  const video = allSchemas.find(s => /VideoObject/i.test(String(s['@type'])));
  if (video) {
    const ok = !!video.name && !!video.thumbnailUrl && !!video.uploadDate;
    const reasons = [];
    if (!video.name) reasons.push('name');
    if (!video.thumbnailUrl) reasons.push('thumbnailUrl');
    if (!video.uploadDate) reasons.push('uploadDate');
    push('Video Rich Result', ok, ok ? [] : reasons.map(r => `Missing ${r}`));
  }

  // ImageObject
  const image = allSchemas.find(s => /ImageObject/i.test(String(s['@type'])));
  if (image) {
    const ok = !!image.url;
    push('Image Rich Result Signals', ok, ok ? [] : ['Add ImageObject.url']);
  }

  // QAPage
  const qa = allSchemas.find(s => /QAPage/i.test(String(s['@type'])));
  if (qa) {
    const ok = Array.isArray(qa.mainEntity) && qa.mainEntity.length > 0;
    push('Q&A Rich Result', ok, ok ? [] : ['QAPage.mainEntity must be a non-empty array']);
  }

  // Article
  const article = allSchemas.find(s => /Article|BlogPosting|NewsArticle/i.test(String(s['@type'])));
  if (article) {
    const ok = !!article.headline && !!article.image && !!article.datePublished && !!article.author;
    const miss = [];
    if (!article.headline) miss.push('headline');
    if (!article.image) miss.push('image');
    if (!article.datePublished) miss.push('datePublished');
    if (!article.author) miss.push('author');
    push('Article Rich Result', ok, ok ? [] : miss.map(m => `Missing ${m}`));
  }

  // ItemList
  const list = allSchemas.find(s => /ItemList/i.test(String(s['@type'])));
  if (list) {
    const ok = Array.isArray(list.itemListElement) && list.itemListElement.length > 0;
    push('ItemList (collections/carousels)', ok, ok ? [] : ['ItemList.itemListElement should be non-empty']);
  }

  // Product
  const prod = allSchemas.find(s => /Product/i.test(String(s['@type'])));
  if (prod) {
    const hasOffer = !!prod.offers;
    const reasons = [];
    if (!hasOffer) reasons.push('offers');
    push('Product Rich Results / Listings', hasOffer, hasOffer ? [] : reasons.map(r => `Missing ${r}`));
  }

  return eligibility;
}

module.exports = {
  richResultsEligibility
};
