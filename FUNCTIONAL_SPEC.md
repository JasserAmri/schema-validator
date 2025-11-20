# Functional Specification: AI + SEO + Schema Analyzer

**Version:** 1.0
**Last Updated:** November 2025
**Product Name:** AI + SEO + Schema Analyzer
**Live URL:** https://schema-validator-ruddy.vercel.app

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [Core Functionality](#core-functionality)
4. [Analysis Categories](#analysis-categories)
5. [Scoring System](#scoring-system)
6. [Validation Rules](#validation-rules)
7. [Rich Results Eligibility](#rich-results-eligibility)
8. [Technical Architecture](#technical-architecture)
9. [API Specification](#api-specification)
10. [User Interface](#user-interface)

---

## 1. Executive Summary

The AI + SEO + Schema Analyzer is a comprehensive web application that analyzes websites for:
- **SEO (Search Engine Optimization)** - Traditional search engine compliance
- **AEO (Answer Engine Optimization)** - Voice search and featured snippet optimization
- **GEO (Generative Engine Optimization)** - AI platform (ChatGPT, Claude, Perplexity) optimization
- **Schema.org Validation** - Structured data compliance checking

The tool provides **9 distinct analysis categories** with **quantified scoring (0-100)**, **actionable recommendations**, and **rich results eligibility assessment**.

---

## 2. Product Overview

### 2.1 Purpose

To help businesses and developers optimize their websites for:
1. Traditional search engines (Google, Bing)
2. AI-powered search platforms (ChatGPT, Claude, Perplexity)
3. Voice assistants (Alexa, Siri, Google Assistant)
4. Social media sharing (Facebook, Twitter, LinkedIn)

### 2.2 Target Users

- **Web Developers** - Implementing structured data
- **SEO Specialists** - Optimizing site visibility
- **Hotel/Hospitality Industry** - Specialized hotel schema validation
- **Content Managers** - Ensuring AI-friendly content structure
- **Marketing Teams** - Social media optimization

### 2.3 Key Features

- **Multi-format Schema Detection** - JSON-LD, Microdata, RDFa
- **25+ Schema Types Validated** - Hotel, LocalBusiness, FAQPage, Product, etc.
- **9 Analysis Dimensions** - Comprehensive coverage
- **Real-time Analysis** - Results in 5-15 seconds
- **Actionable Insights** - Specific recommendations with documentation links
- **Rich Results Preview** - Eligibility for Google rich results

---

## 3. Core Functionality

### 3.1 Input Processing

**Input:**
- User provides a valid HTTP/HTTPS URL
- URL is validated using JavaScript `URL()` constructor
- Invalid URLs rejected with clear error message

**Validation Checks:**
```javascript
1. URL format validation (must be valid URL)
2. Protocol validation (must be http:// or https://)
3. Length validation (reasonable URL length)
```

### 3.2 Data Fetching

**Process:**
1. HTTP GET request to target URL
2. Timeout: 15 seconds (configurable)
3. Max size: 10MB (configurable)
4. Max redirects: 5 hops
5. User-Agent: Chrome 120 (to bypass basic bot detection)

**Error Handling:**
- `ENOTFOUND` → "Unable to reach the URL"
- `ETIMEDOUT` → "Request timed out"
- `403` → "Access forbidden"
- `404` → "Page not found"
- `429` → "Too many requests"
- `5xx` → "Website server errors"

### 3.3 Analysis Pipeline

```
URL Input → Fetch HTML → Parse with Cheerio →
Extract Schemas (JSON-LD/Microdata/RDFa) →
Run 9 Parallel Analyzers →
Aggregate Results →
Calculate Scores →
Return JSON Response
```

**Parallel Analyses:**
1. Schema.org validation
2. robots.txt analysis
3. llms.txt analysis
4. ai.txt analysis
5. OpenGraph/Twitter analysis
6. sitemap.xml analysis
7. FAQ/HowTo analysis
8. Breadcrumb analysis
9. Content structure analysis
10. Performance analysis
11. Meta consistency check
12. Canonical/OG alignment
13. Crawlability assessment
14. Rich results eligibility

---

## 4. Analysis Categories

### 4.1 Schema.org Validation

**Purpose:** Validate structured data markup compliance with Schema.org specifications

**What It Checks:**

#### 4.1.1 Schema Extraction
- **JSON-LD** (preferred format)
  - Extracts from `<script type="application/ld+json">`
  - Handles single objects and `@graph` arrays
  - Cleans malformed JSON (trailing commas, unquoted keys)

- **Microdata** (HTML5 attributes)
  - Parses `itemscope`, `itemtype`, `itemprop` attributes
  - Handles nested itemscopes
  - Absolutizes relative URLs

- **RDFa** (Semantic HTML)
  - Parses `typeof`, `property` attributes
  - Handles `schema:` namespace prefixes

#### 4.1.2 Validation Rules by Schema Type

**Hotel Schema** (Max: varies by properties)
```javascript
Required Properties (25 points each):
- name (string) - Hotel name
- address (object: PostalAddress) - Physical address

Recommended Properties (15 points each):
- telephone (string) - Contact number
- description (string) - Hotel description
- image (URL) - Hotel image
- priceRange (string) - Price indicator (e.g., "$$$$")
- amenityFeature (array) - Hotel amenities
- url (URL) - Hotel website

Optional with Validation:
- checkinTime (time format: "15:00" or "15:00:00")
- checkoutTime (time format: "11:00")
- geo (object: GeoCoordinates)
- aggregateRating (object: AggregateRating)
```

**LocalBusiness Schema**
```javascript
Required:
- name (string)
- address (PostalAddress)

Recommended:
- telephone, description, image, url
- priceRange, openingHours
- geo (GeoCoordinates)
- sameAs (array of social media URLs)
```

**FAQPage Schema**
```javascript
Required:
- mainEntity (array of Question objects)

Question Object Structure:
- @type: "Question"
- name: "Question text"
- acceptedAnswer:
  - @type: "Answer"
  - text: "Answer text (50+ words recommended)"

Scoring:
- Question name > 20 chars: +10 points
- Answer > 100 words: +15 points
- Answer 50-100 words: +10 points
- Answer < 50 words: recommendation issued
```

**Product Schema**
```javascript
Required:
- name (string)

Recommended:
- description, image, offers
- category, brand
- aggregateRating

Rich Results Eligibility:
- Must have offers property
- Offers should include price, priceCurrency, availability
```

**Review Schema**
```javascript
Required:
- reviewRating (object: Rating with ratingValue)
- author (object: Person/Organization)

Recommended:
- reviewBody (string)
- datePublished (ISO 8601 date)
- itemReviewed (object)
```

**AggregateRating Schema**
```javascript
Required:
- ratingValue (number)
- reviewCount (number)

Recommended:
- bestRating (number, default 5)
- worstRating (number, default 1)
```

**Organization Schema**
```javascript
Required:
- name (string)

Recommended:
- url, description, image, logo
- address, telephone
- sameAs (array) - Social media profiles
```

**BreadcrumbList Schema**
```javascript
Required:
- itemListElement (array of ListItem)

ListItem Structure:
- @type: "ListItem"
- position (number, starting from 1)
- name (string)
- item (URL or object with @id)

Scoring:
- Exists: +40 points
- 3+ items: +15 points
- Each properly structured item: +5 points
- Correct position numbering: +10 points
```

**VideoObject Schema**
```javascript
Required:
- name, thumbnailUrl, uploadDate

Recommended:
- description, contentUrl, embedUrl
- duration (ISO 8601 duration)
- inLanguage
```

**WebSite Schema**
```javascript
Required:
- name

Recommended:
- url
- potentialAction (SearchAction for sitelinks searchbox)

SearchAction Structure:
- @type: "SearchAction"
- target: "https://example.com/search?q={search_term_string}"
- query-input: "required name=search_term_string"
```

#### 4.1.3 Format Validation

**URL Validation:**
```javascript
- Must be valid URL (new URL(value) doesn't throw)
- Should be absolute (start with http:// or https://)
- Relative URLs converted to absolute using base URL
```

**Date Validation:**
```javascript
Regex: /^\d{4}-\d{2}-\d{2}([Tt ][\d:.\-+Zz]+)?$/
Valid formats:
- "2024-01-15"
- "2024-01-15T14:30:00"
- "2024-01-15T14:30:00Z"
- "2024-01-15T14:30:00-05:00"
```

**Time Validation:**
```javascript
Valid formats:
- "15:00" (HH:MM)
- "15:00:00" (HH:MM:SS)
```

**Number Validation:**
```javascript
- Must be numeric
- Can be string or number type
- isNaN() check
```

#### 4.1.4 Scoring Algorithm

```javascript
Total Score = Required Properties Score + Recommended Properties Score

Required Properties:
- Each present: +25 points
- Missing: -25 points (marks as invalid)

Recommended Properties:
- Each present: +15 points
- Missing: 0 points (recommendation issued)

Max Score = (# required × 25) + (# recommended × 15)

Final Score = (Actual Points / Max Points) × 100
```

**Score Classification:**
- 85-100: Excellent (green)
- 70-84: Good (light green)
- 45-69: Fair (yellow)
- 0-44: Poor (red)

---

### 4.2 robots.txt Analysis

**Purpose:** Analyze robots.txt file for search engine and AI crawler directives

**What It Fetches:**
```
Target URL: https://example.com/robots.txt
Timeout: 6 seconds (configurable via TIMEOUT_ROBOTS)
Max Size: 10MB
```

**What It Checks:**

#### 4.2.1 File Existence
- File accessible at /robots.txt
- Returns 200 status code
- **Score:** +30 points if exists

#### 4.2.2 AI Crawler Directives
Checks for AI platform bot names:
```javascript
Recognized AI Bots:
- GPTBot (OpenAI/ChatGPT)
- ChatGPT-User (ChatGPT browsing)
- ClaudeBot (Anthropic Claude)
- Claude-Web (Claude browsing)
- PerplexityBot (Perplexity AI)
```

**Detection:**
```javascript
User-agent: GPTBot
Disallow: /admin/
Allow: /

Parsing Logic:
- Line starts with "User-agent:" (case-insensitive)
- Extract bot name
- Check if contains ai bot keywords
```

**Scoring:**
- AI bots found: +25 points
- No AI bots: 0 points + recommendation

#### 4.2.3 Sitemap Declaration
```javascript
Looks for:
Sitemap: https://example.com/sitemap.xml

Scoring:
- Sitemap found: +20 points
- Missing: issue logged
```

#### 4.2.4 User Agent Diversity
```javascript
Scoring:
- Multiple user agents (>1): +15 points
- Single or default only: 0 points
```

#### 4.2.5 Advanced Directives (Recommendations)

**Crawl-Delay:**
```javascript
Regex: /crawl-delay/i
If missing: "Consider adding crawl-delay to protect performance"
```

**Disallow All Check:**
```javascript
Regex: /Disallow:\s*\/\s*$/i
If found: "robots.txt blocks everything—ensure that's intended"
```

**Maximum Score:** 100 points

---

### 4.3 llms.txt Analysis

**Purpose:** Analyze AI-specific content guidelines file (emerging standard)

**What It Fetches:**
```
Target: /llms.txt
Timeout: 6 seconds
Format: Plain text with markdown-style headers
```

**What It Checks:**

#### 4.3.1 Content Structure

**Section Detection:**
```javascript
Headers (start with "# "):
Common sections:
- # About
- # Business Information
- # Company
- # Guidelines for AI Systems
- # Usage
- # Contact

Scoring:
- Has sections: +20 points
- No sections: issue logged
```

#### 4.3.2 Content Quality Analysis

**Word Count:**
```javascript
> 500 chars: "comprehensive" → +40 points
200-500 chars: "good" → +25 points
50-200 chars: "basic" → +10 points
< 50 chars: minimal → 0 points
```

#### 4.3.3 Business Information
```javascript
Detection Regex: /about|business|company/i

If present: +20 points
If missing: "Include a business overview section"
```

#### 4.3.4 AI Guidelines
```javascript
Detection Regex: /guidelines|ai systems|usage/i

If present: +15 points
If missing: "Add AI usage guidelines section"
```

#### 4.3.5 Contact Information
```javascript
Detection Regex: /contact|email|phone/i

If present: +5 points
If missing: "Consider contact details for AI systems"
```

**Maximum Score:** 100 points

---

### 4.4 ai.txt Analysis

**Purpose:** Analyze AI crawler permissions file (proposed standard)

**What It Fetches:**
```
Target: /ai.txt
Format: Similar to robots.txt
Timeout: 6 seconds
```

**What It Checks:**

#### 4.4.1 File Existence
- Exists at /ai.txt
- **Score:** +30 points

#### 4.4.2 AI Bot Permissions
```javascript
Format:
User-agent: GPTBot
Allow: /public/
Disallow: /private/

Detection:
- Lines with "user-agent:" (case-insensitive)
- Check for GPT, Claude, Perplexity in name

Scoring:
- Has AI bot permissions: +25 points
- Missing: "Add AI crawler permissions"
```

#### 4.4.3 Usage Guidelines
```javascript
Detection Regex: /guidelines|usage/i

If present: +20 points
If missing: issue logged
```

#### 4.4.4 Attribution Requirements
```javascript
Detection Regex: /attribution|citation|credit/i

If present:
- Sets attributionRequired = true
- +15 points
If missing: "Consider attribution/citation guidance"
```

#### 4.4.5 Comprehensive Coverage
```javascript
Multiple AI bots configured: +10 points
```

**Maximum Score:** 100 points

---

### 4.5 OpenGraph & Twitter Card Analysis

**Purpose:** Validate social media sharing metadata

**What It Checks:**

#### 4.5.1 OpenGraph Tags (Facebook, LinkedIn)

**Required Tags (15 points each):**
```javascript
og:title - Page title for social sharing
og:description - Page description
og:image - Preview image URL
og:url - Canonical URL of page

Total for all 4: 60 points
```

**Quality Checks:**

**Title Quality:**
```javascript
If og:title > 10 chars: +10 points
If og:title <= 10 chars: "Consider longer, more descriptive og:title"
```

**Description Quality:**
```javascript
If og:description > 50 chars: +10 points
If og:description <= 50 chars: "Use longer og:description (50+ chars)"
```

**Image Properties:**
```javascript
Base image: +10 points

Optional dimensions:
If og:image:width AND og:image:height present: +5 points
If missing: "Add og:image:width and og:image:height"

URL validation:
If relative URL: "Use absolute URL for og:image"
```

**Type Property:**
```javascript
og:type present: +5 points
og:type = "hotel": +5 bonus points
If missing: issue logged
```

#### 4.5.2 Hotel-Specific OpenGraph

**Special Properties (5 points each):**
```javascript
hotel:amenity - Hotel amenity (e.g., "pool", "spa")
hotel:checkin_time - Check-in time
hotel:checkout_time - Check-out time
hotel:price_range - Price indicator
```

#### 4.5.3 Twitter Card Tags

**Detection:**
```javascript
meta[name^="twitter:"]
  twitter:card - Card type (summary, summary_large_image)
  twitter:title - Title for Twitter
  twitter:description - Description
  twitter:image - Preview image
  twitter:site - @username of site
  twitter:creator - @username of content creator
```

**Scoring:**
```javascript
If Twitter tags present:
- Adds "Twitter/X" to socialCoverage array
- Implicit quality points
```

#### 4.5.4 Social Coverage
```javascript
Tracked platforms:
- Facebook (if og: tags present)
- Twitter/X (if twitter: tags present)

Display: Shows which platforms optimized for
```

**Maximum Score:** 100 points

---

### 4.6 sitemap.xml Analysis

**Purpose:** Validate XML sitemap for search engine crawling

**What It Fetches:**
```
Target: /sitemap.xml
Timeout: 8 seconds
Parser: Cheerio with xmlMode: true
```

**What It Checks:**

#### 4.6.1 XML Validity
```javascript
Valid root elements:
- <urlset> - Standard sitemap
- <sitemapindex> - Sitemap index file

If valid: +20 points
If missing root: "Invalid XML: missing urlset/sitemapindex"
```

#### 4.6.2 URL Count
```javascript
Counts: <url> elements

If > 0 URLs: +25 points
If 0 URLs: "No URLs found in sitemap"

Recommendation:
If < 10 URLs: "Add more important URLs to sitemap"
```

#### 4.6.3 URL Properties

**Priority Analysis:**
```javascript
<priority>0.8</priority>

Extract all priorities:
- Convert to float
- Check range (0.0 to 1.0)
- Verify diversity

If max=1.0 AND min>=0.1: +10 points
(Shows proper prioritization strategy)
```

**Change Frequency:**
```javascript
<changefreq>weekly</changefreq>

Valid values:
- always, hourly, daily, weekly, monthly, yearly, never

If > 2 different changefreqs: +5 points
If missing: "Include <changefreq> where applicable"
```

**Last Modified:**
```javascript
<lastmod>2024-01-15T12:00:00Z</lastmod>

Validation: /^\d{4}-\d{2}-\d{2}/
Each valid lastmod: +2 points (cumulative)
```

#### 4.6.4 Image Sitemap
```javascript
Detection:
<image:image> or <image>

If present: +10 points
Sets hasImages = true
```

#### 4.6.5 Recommendations
```javascript
If priorities.length === 0:
  "Include <priority> to guide crawlers"

If changeFreqs.length === 0:
  "Include <changefreq> where applicable"
```

**Maximum Score:** 100 points

---

### 4.7 FAQ / HowTo Schema Analysis (AEO)

**Purpose:** Optimize for Answer Engine Optimization and featured snippets

**What It Analyzes:**

#### 4.7.1 FAQ Schema Validation

**Schema Detection:**
```javascript
@type: "FAQPage"
mainEntity: [array of Questions]

Question Structure:
{
  "@type": "Question",
  "name": "Question text?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Answer content"
  }
}
```

**Quality Scoring:**

**Question Quality:**
```javascript
For each question:
  If name.length > 20 chars: +10 points
  (Encourages descriptive questions)
```

**Answer Quality:**
```javascript
Extract text (strip HTML):
Word count = text.split(/\s+/).length

If words > 100: +15 points (comprehensive)
If words 50-100: +10 points (good)
If words < 50: recommendation
  "Provide more detailed FAQ answers (50+ words)"
```

**Missing Answer:**
```javascript
If !acceptedAnswer?.text:
  Issue: "FAQ question missing acceptedAnswer.text"
```

#### 4.7.2 HowTo Schema Validation

**Schema Detection:**
```javascript
@type: "HowTo"
Required:
- name: "How to..."
- step: [array of HowToStep]

Step Structure:
{
  "@type": "HowToStep",
  "text": "Step description",
  "name": "Step name (optional)",
  "image": "Step image URL (optional)"
}
```

**Quality Scoring:**

**Step Quality:**
```javascript
For each step:
  Extract text/description
  Length = text.length

  If length > 30: +15 points (detailed)
  If length <= 30: +8 points (basic)
```

**Missing Step Content:**
```javascript
If !step.text && !step.description:
  Issue: "HowTo step missing text/description"
```

**Complete HowTo:**
```javascript
If has name AND description: +10 points
```

#### 4.7.3 Overall Scoring

**Base Score:**
```javascript
totalItems = totalQuestions + totalSteps

If totalItems > 0: +30 points (has AEO content)
If faqQuality > 50 OR howToQuality > 50: +25 points
If totalItems > 5: +20 points (comprehensive)
If totalItems 2-5: +10 points (good)
If totalQuestions > 0: +15 points
If totalSteps > 0: +10 points
```

#### 4.7.4 Featured Snippet Potential

**Assessment:**
```javascript
if faqQuality > 70 && totalQuestions > 3:
  potential = "high"
else if faqQuality > 40 && totalQuestions > 1:
  potential = "medium"
else:
  potential = "low"
```

**Recommendation:**
```javascript
If no FAQ schemas:
  "Add FAQPage schema for common questions"
```

**Maximum Score:** 100 points

---

### 4.8 Breadcrumb Analysis

**Purpose:** Validate navigational breadcrumbs for SEO and UX

**What It Checks:**

#### 4.8.1 JSON-LD Breadcrumbs (Preferred)

**Schema Detection:**
```javascript
@type: "BreadcrumbList"
itemListElement: [array of ListItems]

Structure:
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://example.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Category",
      "item": "https://example.com/category"
    }
  ]
}
```

**Scoring:**
```javascript
If found: +40 points (structured = true)
If depth >= 3: +15 points (good hierarchy)

For each item:
  Check position = index + 1 (sequential)
  Check has name
  Check has item or item.@id

  If all valid: +5 points
  If invalid: issue logged
```

#### 4.8.2 Microdata/HTML Breadcrumbs

**Detection:**
```javascript
Selectors:
- [itemtype*="BreadcrumbList"]
- nav[aria-label*="breadcrumb"]
- .breadcrumb
- [class*="breadcrumb"]

If found (when no JSON-LD):
  type = "Microdata/HTML"
  exists = true
  +35 points

Depth = count of list items:
- $('li').length
- $('[itemprop="itemListElement"]').length

If depth >= 3: +10 points
```

#### 4.8.3 Recommendations

**Missing Breadcrumbs:**
```javascript
If !exists:
  Issue: "No breadcrumb navigation found"
  Recommendation: "Add JSON-LD BreadcrumbList for better SEO"
```

**Maximum Score:** 100 points

---

### 4.9 Content Structure Analysis

**Purpose:** Analyze content for AI readability and SEO best practices

**What It Checks:**

#### 4.9.1 Header Hierarchy

**Detection:**
```javascript
For h1 through h6:
  count = $('h1').length, $('h2').length, etc.

Scoring:
Each header type present: +5 points (max 30)
```

**H1 Validation:**
```javascript
If h1 === 1: +15 points (perfect)
If h1 === 0: issue "Missing H1 tag"
If h1 > 1: issue "Multiple H1 tags detected"
```

**Hierarchy Quality:**
```javascript
If h1 > 0 && h2 > 0: +10 points (has structure)
If h2 > 0 && h3 > 0: +5 points (good depth)
```

#### 4.9.2 Paragraph Analysis

**Extraction:**
```javascript
paragraphs = $('p').map((i, p) => $(p).text().trim())
  .get()
  .filter(Boolean)

Statistics:
- count: paragraphs.length
- lengths: paragraphs.map(t => t.length)
- average: sum(lengths) / count
- min: Math.min(...lengths)
- max: Math.max(...lengths)
```

**Scoring:**
```javascript
If count > 0: +10 points (has paragraphs)
If average > 100: +10 points (substantial content)
If average < 50: recommendation
  "Consider longer paragraphs (100+ chars)"
```

#### 4.9.3 List Detection

**Detection:**
```javascript
lists = $('ul, ol')

If lists.length > 0: +10 points (uses lists)

For each list:
  items = $(list).find('li').length
  If items > 2: +5 points (substantial list)
```

**Recommendation:**
```javascript
If lists.length === 0:
  "Add bullet/numbered lists where helpful"
```

#### 4.9.4 Content Density

**Measurement:**
```javascript
bodyText = $('body').text()
  .replace(/\s+/g, ' ')
  .trim()

length = bodyText.length

If length > 1000: "comprehensive" → +15 points
If length 500-1000: "good" → +10 points
If length 200-500: "basic" → +5 points
If length < 200: issue "Very short content on page"
```

#### 4.9.5 Readability Score (Flesch-Kincaid)

**Algorithm:**
```javascript
function fleschKincaidReadingEase(text):
  words = countWords(text)
  sentences = countSentences(text)
  syllables = sum of syllables for each word

  ASL = words / sentences  // Average Sentence Length
  ASW = syllables / words  // Average Syllables per Word

  score = 206.835 - (1.015 × ASL) - (84.6 × ASW)
  return clamp(score, 0, 100)

Syllable Counting (Heuristic):
1. Convert to lowercase
2. Remove non-letters
3. Remove ending: -es, -ed, -e (not -le)
4. Count vowel groups: /[aeiouy]{1,2}/g
5. Minimum 1 syllable per word
```

**Scoring:**
```javascript
If readability >= 70: +10 points (easy to read)
If readability 50-69: +5 points (moderate)
If readability < 50: 0 points (difficult)
```

**Readability Scale:**
- 90-100: Very Easy (5th grade)
- 80-89: Easy (6th grade)
- 70-79: Fairly Easy (7th grade)
- 60-69: Standard (8th-9th grade)
- 50-59: Fairly Difficult (10th-12th grade)
- 30-49: Difficult (College)
- 0-29: Very Difficult (College graduate)

**Maximum Score:** 100 points

---

### 4.10 Performance Analysis

**Purpose:** Estimate Core Web Vitals and page performance

**What It Analyzes:**

#### 4.10.1 Page Size & Resource Count

**Measurement:**
```javascript
size = html.length // in bytes
sizeKB = Math.round(size / 1024)

resources:
- images = $('img').length
- scripts = $('script').length
- styles = $('link[rel="stylesheet"]').length

requests = images + scripts + styles
```

**Size Scoring:**
```javascript
If size < 50KB: +25 points, loadTime = "< 1s"
If size 50-100KB: +15 points, loadTime = "1-2s"
If size 100-200KB: +10 points, loadTime = "2-3s"
If size > 200KB: 0 points, loadTime = "> 3s"
  issue "Large HTML size; consider compression/trim"
```

**Request Scoring:**
```javascript
If requests < 20: +25 points (efficient)
If requests 20-50: +15 points (moderate)
If requests 50-100: +5 points (heavy)
If requests > 100: 0 points
  issue "Too many resources; consider lazy-load and bundling"
```

#### 4.10.2 Core Web Vitals Estimation

**Largest Contentful Paint (LCP):**
```javascript
Based on image count (heuristic):

If images === 0:
  LCP = { value: "1.2s", score: 90, status: "good" }
  +15 points

If images <= 5:
  LCP = { value: "2.1s", score: 75, status: "needs-improvement" }
  +10 points

If images > 5:
  LCP = { value: "3.8s", score: 40, status: "poor" }
  issue "Many images may worsen LCP; optimize"
```

**First Input Delay (FID):**
```javascript
Based on script count:

If scripts <= 3:
  FID = { value: "45ms", score: 95, status: "good" }
  +15 points

If scripts 4-8:
  FID = { value: "120ms", score: 65, status: "needs-improvement" }
  +8 points

If scripts > 8:
  FID = { value: "280ms", score: 30, status: "poor" }
  issue "Heavy JS can worsen FID; defer/split"
```

**Cumulative Layout Shift (CLS):**
```javascript
hasViewport = $('meta[name="viewport"]').length > 0
fixedDimensions = $('img[width][height]').length

If hasViewport && fixedDimensions > 0:
  CLS = { value: "0.05", score: 95, status: "good" }
  +15 points

If hasViewport only:
  CLS = { value: "0.15", score: 65, status: "needs-improvement" }
  +8 points

If !hasViewport:
  CLS = { value: "0.35", score: 20, status: "poor" }
  issue "Missing viewport meta; critical for mobile"
```

#### 4.10.3 Mobile Friendliness

**Detection:**
```javascript
hasViewport = $('meta[name="viewport"]').length > 0

If hasViewport:
  mobileFriendly = true
  +15 points (performance)
  +20 points (technical SEO)
else:
  recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0">'
```

**PWA Indicators:**
```javascript
If $('meta[name="theme-color"]').length > 0:
  +5 points (performance)
  +10 points (technical SEO)

If $('link[rel="manifest"]').length > 0:
  +5 points (performance)
  +10 points (technical SEO)
```

#### 4.10.4 Structured Data Density

**Detection:**
```javascript
jsonLdCount = $('script[type="application/ld+json"]').length
microCount = $('[itemscope]').length
rdfaCount = $('[typeof]').length

If any > 0:
  +20 points (technical SEO)
  +10 points (performance score)
else:
  issue "No structured data found"
```

#### 4.10.5 Recommendations

**JavaScript:**
```javascript
If scripts > 5:
  "Reduce JS files or split/defer to improve interactivity"
```

**CSS:**
```javascript
If styles > 3:
  "Combine CSS or use critical CSS"
```

**Images:**
```javascript
If images > 10:
  "Use compression and lazy-loading for images"
```

**Maximum Score:** 100 points

---

### 4.11 Meta Consistency Check

**Purpose:** Ensure metadata consistency across different formats

**What It Checks:**

#### 4.11.1 Meta Tag Extraction

**Standard Meta:**
```javascript
title = $('title').first().text().trim()
metaDesc = $('meta[name="description"]').attr('content') || ''
```

**OpenGraph Meta:**
```javascript
ogTitle = $('meta[property="og:title"]').attr('content') || ''
ogDesc = $('meta[property="og:description"]').attr('content') || ''
```

**Schema.org Name:**
```javascript
Find primary schema:
- Hotel, LocalBusiness, Organization, Product, Article
Extract: schema.name
```

#### 4.11.2 Consistency Checks

**Title vs Schema Name:**
```javascript
If title && schemaName:
  If title.toLowerCase().includes(schemaName.toLowerCase()):
    +25 points (consistent branding)
```

**Meta Description vs OG Description:**
```javascript
Compare first 60 characters:
If metaDesc.slice(0, 60) === ogDesc.slice(0, 60):
  +15 points (consistent messaging)
```

**Title vs OG Title:**
```javascript
Compare first 50 characters:
If title.slice(0, 50) === ogTitle.slice(0, 50):
  +15 points (consistent titles)
```

#### 4.11.3 Missing Meta Warnings

**Recommendations:**
```javascript
If !schemaName:
  "Primary entity missing a clear name"

If !metaDesc:
  "Add <meta name='description'>"

If !ogTitle || !ogDesc:
  "Add OpenGraph title/description for consistency"
```

**Maximum Score:** 100 points (based on consistency)

---

### 4.12 Canonical & OG URL Alignment

**Purpose:** Ensure URL consistency for SEO and social sharing

**What It Checks:**

#### 4.12.1 URL Extraction

**Canonical URL:**
```javascript
canonical = $('link[rel="canonical"]').attr('href') || ''
resolvedCanonical = absolutize(canonical, pageUrl)
```

**OpenGraph URL:**
```javascript
ogUrl = $('meta[property="og:url"]').attr('content') || ''
resolvedOg = absolutize(ogUrl, pageUrl)
```

**Actual Page URL:**
```javascript
pageUrl = final URL after redirects
```

#### 4.12.2 Alignment Checks

**Canonical = OG URL:**
```javascript
If resolvedCanonical === resolvedOg:
  +40 points (perfect alignment)
```

**Canonical = Page URL:**
```javascript
Remove hash/fragment:
canonicalBase = resolvedCanonical.split('#')[0]
pageBase = pageUrl.split('#')[0]

If canonicalBase === pageBase:
  +30 points (self-canonical)
```

#### 4.12.3 Missing Elements

**Recommendations:**
```javascript
If !resolvedCanonical:
  "Add a rel='canonical' link"

If !resolvedOg:
  "Add og:url for clarity"
```

**Maximum Score:** 70 points

---

### 4.13 Crawlability Assessment

**Purpose:** Check if page is crawlable by search engines

**What It Checks:**

#### 4.13.1 Robots Meta Tag

**Detection:**
```javascript
robotsMeta = $('meta[name="robots"]').attr('content') || ''

Checks:
isNoIndex = /noindex/i.test(robotsMeta)
isNoFollow = /nofollow/i.test(robotsMeta)
```

**Scoring:**
```javascript
Start: 50 points

If isNoIndex:
  Issue: "Page is noindex"
  -40 points

If isNoFollow:
  Recommendation: "Avoid nofollow on important pages"
  -10 points
```

#### 4.13.2 Internal Links

**Detection:**
```javascript
anchors = $('a[href]').map((i, a) => $(a).attr('href')).get()

internal = anchors.filter(href =>
  href && !/^https?:\/\//i.test(href)
).length

nofollowLinks = $('a[rel*="nofollow"]').length
```

**Recommendation:**
```javascript
If internal === 0:
  "Add internal links to important pages"
```

**Maximum Score:** 50 points (baseline - deductions applied)

---

## 5. Scoring System

### 5.1 Individual Analysis Scores

Each analysis returns:
```javascript
{
  score: 0-100,        // Actual points earned
  maxScore: 100,       // Maximum possible (usually 100)
  issues: [],          // Blocking problems
  recommendations: []  // Suggestions for improvement
}
```

### 5.2 Schema Validation Overall Score

**Calculation:**
```javascript
For each matched schema:
  schemaScore = validateSchema(schema, type).score
  schemaMaxScore = validateSchema(schema, type).maxScore

totalScore = sum of all schemaScore values
totalMaxScore = sum of all schemaMaxScore values
schemaCount = number of matched schemas

averageScore = Math.round(totalScore / schemaCount)
```

**Display:**
```javascript
validation: {
  averageScore: 85,      // Average across all schemas
  totalScore: 255,       // Sum of actual points
  totalMaxScore: 300,    // Sum of max points
  schemaCount: 3         // Number of schemas validated
}
```

### 5.3 Score Color Coding

**Frontend Display:**
```javascript
function scoreClass(score) {
  if (score >= 85) return 'excellent'  // Bright green
  if (score >= 70) return 'good'       // Light green
  if (score >= 45) return 'fair'       // Yellow
  return 'poor'                         // Red
}
```

### 5.4 Aggregate Insights

**Summary Metrics:**
- Total Schemas Found (all formats)
- Validated Target Schemas (matched to supported types)
- Average Validation Score (0-100)
- Rich Results Eligible Features

---

## 6. Validation Rules

### 6.1 Data Type Validation

**String:**
```javascript
Valid: Any string value
Example: "Grand Plaza Hotel"
```

**URL:**
```javascript
Validation: new URL(value) doesn't throw
Should be absolute: /^https?:\/\//
Example: "https://example.com/image.jpg"
```

**Number:**
```javascript
Validation: !isNaN(Number(value))
Example: 4.8, "4.8", 5
```

**Date:**
```javascript
Format: ISO 8601
Regex: /^\d{4}-\d{2}-\d{2}([Tt ][\d:.\-+Zz]+)?$/
Examples:
  "2024-01-15"
  "2024-01-15T14:30:00Z"
  "2024-01-15T14:30:00-05:00"
```

**Time:**
```javascript
Formats:
  "HH:MM" - /^([01]\d|2[0-3]):([0-5]\d)$/
  "HH:MM:SS" - /^\d{2}:\d{2}:\d{2}$/
Examples: "15:00", "15:00:00"
```

**Boolean:**
```javascript
Valid: true, false (JSON boolean)
Example: true
```

**Object:**
```javascript
Valid: Nested JSON object
Must have @type property for schema objects
Example: { "@type": "PostalAddress", "streetAddress": "123 Main St" }
```

**Array:**
```javascript
Valid: JSON array
May contain strings, objects, or mixed
Example: ["WiFi", "Pool", "Parking"]
```

### 6.2 Required vs Recommended

**Required Properties:**
- Missing = validation fails (isValid: false)
- Each missing = issue logged
- Affects eligibility for rich results
- -25 points per missing property

**Recommended Properties:**
- Missing = recommendation logged
- No effect on validity
- Improves score when present
- +15 points per present property

### 6.3 Schema.org Type Hierarchy

**Inheritance:**
```javascript
Hotel
  ↳ LodgingBusiness
    ↳ LocalBusiness
      ↳ Organization
        ↳ Thing

Properties inherit up the chain.
Hotel includes all LocalBusiness properties.
```

---

## 7. Rich Results Eligibility

### 7.1 Purpose

Google Rich Results are enhanced search results with visual elements, structured data, and interactive features.

### 7.2 Eligibility Checks

#### 7.2.1 Sitelinks Searchbox

**Requirements:**
```javascript
Schema: WebSite
Properties needed:
  @type: "WebSite"
  potentialAction:
    @type: "SearchAction"
    target: "https://example.com/search?q={search_term_string}"
    query-input: "required name=search_term_string"

Check:
hasSearchAction = pa && /SearchAction/i.test(pa['@type'])
hasTarget = !!pa.target
hasQueryInput = /required/.test(pa['query-input'] || pa['queryInput'])

Eligible if: hasSearchAction && hasTarget && hasQueryInput
```

#### 7.2.2 Organization Logo

**Requirements:**
```javascript
Schema: Organization
Properties needed:
  @type: "Organization"
  logo: "https://example.com/logo.png"
  url: "https://example.com"

Eligible if: !!org.logo && !!org.url
```

#### 7.2.3 LocalBusiness Contact

**Requirements:**
```javascript
Schema: LocalBusiness/Hotel/LodgingBusiness
Properties needed:
  contactPoint:
    @type: "ContactPoint"
    telephone: "+1-555-123-4567"
    contactType: "customer service"
    availableLanguage: ["English", "Spanish"]

Eligible if: !!business.contactPoint
```

#### 7.2.4 Video Rich Result

**Requirements:**
```javascript
Schema: VideoObject
Properties needed:
  name: "Video title"
  thumbnailUrl: "https://example.com/thumb.jpg"
  uploadDate: "2024-01-15"

Missing any:
  reasons: ["Missing name", "Missing thumbnailUrl", "Missing uploadDate"]
```

#### 7.2.5 Image Rich Result

**Requirements:**
```javascript
Schema: ImageObject
Properties needed:
  url: "https://example.com/image.jpg"

Eligible if: !!image.url
```

#### 7.2.6 Q&A Rich Result

**Requirements:**
```javascript
Schema: QAPage
Properties needed:
  mainEntity: [array of Questions]
  mainEntity.length > 0

Eligible if: Array.isArray(qa.mainEntity) && qa.mainEntity.length > 0
```

#### 7.2.7 Article Rich Result

**Requirements:**
```javascript
Schema: Article/BlogPosting/NewsArticle
Properties needed:
  headline: "Article title"
  image: "https://example.com/article-image.jpg"
  datePublished: "2024-01-15"
  author: { "@type": "Person", "name": "John Doe" }

Missing tracking:
if (!headline) reasons.push("Missing headline")
if (!image) reasons.push("Missing image")
if (!datePublished) reasons.push("Missing datePublished")
if (!author) reasons.push("Missing author")
```

#### 7.2.8 ItemList (Carousel)

**Requirements:**
```javascript
Schema: ItemList
Properties needed:
  itemListElement: [array of items]
  itemListElement.length > 0

Eligible if: Array.isArray(list.itemListElement) && list.itemListElement.length > 0
```

#### 7.2.9 Product Listings

**Requirements:**
```javascript
Schema: Product
Properties needed:
  offers: object or array

Eligible if: !!product.offers
Reasons if missing: ["Missing offers"]
```

### 7.3 Response Format

```javascript
richEligibility: [
  {
    feature: "Sitelinks Searchbox (WebSite + SearchAction)",
    eligible: true,
    reasons: []
  },
  {
    feature: "Organization Logo",
    eligible: false,
    reasons: ["Add Organization.logo and Organization.url"]
  }
  // ... more features
]
```

---

## 8. Technical Architecture

### 8.1 Technology Stack

**Backend:**
- Node.js (v14+)
- Express.js (v4.18.2)
- axios (v1.6.0) - HTTP client
- cheerio (v1.0.0-rc.12) - HTML parsing
- cors (v2.8.5) - Cross-origin requests
- dotenv (v17.2.3) - Environment configuration
- express-rate-limit (v8.2.1) - API rate limiting

**Frontend:**
- Vanilla JavaScript (no framework)
- CSS3 with CSS Variables
- Fetch API for AJAX requests

**Deployment:**
- Vercel (serverless functions)
- Port: 3000 (configurable)

### 8.2 Application Flow

```
┌─────────────┐
│   Browser   │
│   (User)    │
└──────┬──────┘
       │ 1. POST /api/analyze {url}
       ▼
┌─────────────────────────┐
│   Express Server        │
│   - Rate Limiting       │
│   - CORS                │
│   - Input Validation    │
└──────┬──────────────────┘
       │ 2. Fetch URL
       ▼
┌─────────────────────────┐
│   Target Website        │
│   (Returns HTML)        │
└──────┬──────────────────┘
       │ 3. HTML Response
       ▼
┌─────────────────────────┐
│   Cheerio Parser        │
│   - Load HTML           │
│   - Parse DOM           │
└──────┬──────────────────┘
       │ 4. Parsed DOM
       ▼
┌─────────────────────────────────────┐
│   Parallel Analyzers (13 modules)   │
├─────────────────────────────────────┤
│ • extractJsonLd()                   │
│ • extractMicrodata()                │
│ • extractRdfa()                     │
│ • validateSchema()                  │
│ • analyzeRobotsTxt()                │
│ • analyzeLlmTxt()                   │
│ • analyzeAiTxt()                    │
│ • analyzeOpenGraph()                │
│ • analyzeSitemap()                  │
│ • analyzeFaqHowToSchema()           │
│ • analyzeBreadcrumbs()              │
│ • analyzeContentStructure()         │
│ • analyzePerformance()              │
│ • analyzeMetaConsistency()          │
│ • analyzeCanonicalOgAlignment()     │
│ • analyzeCrawlability()             │
│ • richResultsEligibility()          │
└──────┬──────────────────────────────┘
       │ 5. Aggregated Results
       ▼
┌─────────────────────────┐
│   Format JSON Response  │
│   - Schemas             │
│   - Scores              │
│   - Issues              │
│   - Recommendations     │
└──────┬──────────────────┘
       │ 6. JSON Response
       ▼
┌─────────────────────────┐
│   Browser (Frontend)    │
│   - Render Results      │
│   - Display Scores      │
│   - Show Issues         │
└─────────────────────────┘
```

### 8.3 Security Features

**Rate Limiting:**
```javascript
Limit: 100 requests per 15 minutes (configurable)
Window: Rolling window
Response: 429 Too Many Requests
```

**Input Validation:**
```javascript
- URL format validation
- URL length check
- Protocol validation (http/https only)
```

**Response Size Limits:**
```javascript
maxContentLength: 10MB
maxBodyLength: 10MB
Prevents memory exhaustion attacks
```

**Error Message Sanitization:**
```javascript
Production: Generic error messages
Development: Detailed error messages
No stack traces exposed to users
```

**CORS Configuration:**
```javascript
Configurable origins via environment
Default: Allow all (*)
Production: Restrict to specific domains
```

### 8.4 Configuration

**Environment Variables:**
```bash
# Server
PORT=3000
NODE_ENV=development

# Security
ALLOWED_ORIGINS=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Timeouts (milliseconds)
TIMEOUT_ROBOTS=6000
TIMEOUT_SITEMAP=8000
TIMEOUT_PAGE=15000
TIMEOUT_GENERAL=10000

# Limits
MAX_CONTENT_LENGTH=10485760
```

---

## 9. API Specification

### 9.1 Endpoint

```
POST /api/analyze
Content-Type: application/json
```

### 9.2 Request

**Body:**
```json
{
  "url": "https://example.com"
}
```

**Validation:**
- url (required): Valid HTTP/HTTPS URL

### 9.3 Response

**Success (200):**
```json
{
  "url": "https://example.com",
  "jsonLd": [...],
  "microdata": [...],
  "rdfa": [...],
  "allSchemasCount": 5,
  "matched": [
    {
      "type": "Hotel",
      "sourceIndex": 0,
      "source": "JSON-LD",
      "data": {...},
      "validation": {
        "isValid": true,
        "score": 85,
        "maxScore": 100,
        "issues": [],
        "recommendations": [],
        "schemaDocs": "https://schema.org/Hotel"
      }
    }
  ],
  "validation": {
    "averageScore": 85,
    "totalScore": 255,
    "totalMaxScore": 300,
    "schemaCount": 3
  },
  "robotsAnalysis": {
    "exists": true,
    "score": 75,
    "maxScore": 100,
    "issues": [],
    "recommendations": [],
    "aiCrawlers": ["GPTBot", "ClaudeBot"],
    "sitemapFound": true,
    "sitemapUrl": "https://example.com/sitemap.xml",
    "userAgents": ["gptbot", "claudebot", "*"]
  },
  "llmAnalysis": {...},
  "aiAnalysis": {...},
  "openGraphAnalysis": {...},
  "sitemapAnalysis": {...},
  "faqHowToAnalysis": {...},
  "breadcrumbAnalysis": {...},
  "contentStructureAnalysis": {...},
  "performanceAnalysis": {...},
  "metaConsistency": {...},
  "canonicalOgAlignment": {...},
  "crawlability": {...},
  "richEligibility": [...]
}
```

**Error (4xx/5xx):**
```json
{
  "error": "Unable to reach the URL. Please check the domain name."
}
```

### 9.4 Error Codes

**400 Bad Request:**
- Missing URL
- Invalid URL format
- Invalid HTML content

**429 Too Many Requests:**
- Rate limit exceeded
- Response: `{ "error": "Too many requests, please try again later." }`

**500 Internal Server Error:**
- Network errors (ENOTFOUND, ETIMEDOUT)
- Target site errors (403, 404, 500-599)
- Parsing errors
- Response: Sanitized user-friendly message

### 9.5 Rate Limiting Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

---

## 10. User Interface

### 10.1 Layout

**Header:**
- Title: "AI • SEO • Schema Analyzer"
- Subtitle: "AEO / GEO / Schema.org / OpenGraph / robots / llms / ai"

**Input Section:**
- URL input field (placeholder: "Enter a URL e.g. https://example.com/page")
- Analyze button
- Loading indicator
- Error message area

**Results Section:**

**Summary Cards (3 columns):**
1. **Summary**
   - Total Schemas
   - Validated Targets
   - Avg Validation Score
   - Matched schema badges

2. **Validation**
   - Total Points
   - Max Points
   - Schemas Validated
   - Score pill (color-coded)

3. **Rich Results Eligibility**
   - Eligible features (green)
   - Not eligible features (red)

**Analysis Cards Grid (3 columns):**
- robots.txt
- llms.txt
- ai.txt
- OpenGraph / Twitter
- Sitemap
- Crawlability
- Meta Consistency
- Canonical / OG Alignment
- Content Structure
- Breadcrumbs
- FAQ / HowTo (AEO)
- Performance

Each card shows:
- Score (0-100 with color coding)
- Key details (2-4 data points)
- Issues (red, with ⚠️)
- Recommendations (green, with 💡)

**Schemas Section:**
- Expandable cards for each schema
- Type badge (e.g., "Hotel")
- Source badge (JSON-LD/Microdata/RDFa)
- MATCH indicator if validated
- Schema.org docs link
- Validation score
- Click to expand:
  - Validation details (issues/recommendations)
  - JSON preview (syntax highlighted)
  - Copy button

### 10.2 Color Scheme

**Background:**
- Primary: #0f1222 (dark blue-black)
- Secondary: #14182c (slightly lighter)
- Cards: #1b2140 (blue-gray)

**Text:**
- Primary: #e6ebff (off-white)
- Muted: #a9b3c9 (gray-blue)

**Scores:**
- Excellent (85-100): #76fcd6 (bright cyan)
- Good (70-84): #0fe4a5 (green)
- Fair (45-69): #ffd36b (yellow)
- Poor (0-44): #ff8b8b (red)

**Accents:**
- Brand 1: #7c5cff (purple)
- Brand 2: #00d4ff (cyan)
- Accent: #4cc9f0 (light blue)

### 10.3 Interactions

**Analyze Button:**
- Click → Disable button + Show loading
- Success → Enable button + Display results
- Error → Enable button + Show error message

**Schema Cards:**
- Click header → Toggle body visibility
- Copy button → Copy JSON to clipboard
  - Shows "Copied!" for 900ms

**Syntax Highlighting:**
- Keys: #9cc9ff (blue)
- Strings: #b0ffcf (green)
- Numbers: #ffb1d2 (pink)
- Booleans: #ffd19c (orange)
- Null: #8893c9 (gray)

### 10.4 Responsive Design

**Desktop (> 900px):**
- 3-column grid for cards
- Full-width schema cards (2 columns)

**Tablet (600-900px):**
- 2-column grid for cards
- Full-width schema cards

**Mobile (< 600px):**
- Single column layout
- Stacked cards
- Full-width elements

---

## 11. Appendix

### 11.1 Supported Schema Types (25)

1. Hotel
2. LodgingBusiness
3. FAQPage
4. Organization
5. Review
6. AggregateRating
7. LocalBusiness
8. Place
9. Product
10. Service
11. JobPosting
12. Restaurant
13. Event
14. BusinessEvent
15. HowTo
16. Article
17. QAPage
18. WebSite
19. BreadcrumbList
20. VideoObject
21. ImageObject
22. ItemList
23. PostalAddress
24. GeoCoordinates
25. Offer

### 11.2 Glossary

**AEO (Answer Engine Optimization):** Optimizing content for voice assistants and featured snippets that provide direct answers.

**GEO (Generative Engine Optimization):** Optimizing for AI platforms like ChatGPT, Claude, and Perplexity that generate responses from web content.

**Schema.org:** Vocabulary of structured data markup supported by major search engines (Google, Bing, Yahoo, Yandex).

**JSON-LD:** JavaScript Object Notation for Linked Data - preferred format for structured data in `<script>` tags.

**Microdata:** HTML5 attributes (itemscope, itemtype, itemprop) for inline structured data.

**RDFa:** Resource Description Framework in Attributes - semantic HTML using typeof and property attributes.

**Rich Results:** Enhanced search results with visual elements (images, ratings, prices) beyond plain links.

**Featured Snippet:** Highlighted answer box at top of Google search results.

**Core Web Vitals:** Google's metrics for page experience (LCP, FID, CLS).

**Canonical URL:** Preferred version of a page when duplicates exist.

---

## Document Version History

**v1.0 - November 2025**
- Initial comprehensive functional specification
- Documented all 9+ analysis categories
- Complete scoring algorithms
- Full validation rules
- API specification
- UI documentation

---

**End of Functional Specification**
