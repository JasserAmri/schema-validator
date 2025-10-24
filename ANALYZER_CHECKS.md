# 📋 **Schema Analyzer Enhancement Plan**

## 🔍 **What the Analyzer Will Check For**

### 🎯 **Current Capabilities (Schema.org)**
✅ **Already Implemented & Working:**
- JSON-LD structured data extraction
- Microdata attribute parsing
- RDFa vocabulary detection
- Schema type matching (Hotel, FAQPage, Organization, etc.)
- Nested schema validation (@graph structures)

### 🚀 **New AI SEO Analysis**

#### 1. **LLM.txt File Analysis**
**What it will check:**
- ✅ **File existence**: `/llms.txt` at website root
- ✅ **Content quality**: Structured markdown format
- ✅ **AI guidelines**: Instructions for language models
- ✅ **Site overview**: Business description and purpose
- ✅ **Content priorities**: What content LLMs should focus on
- ✅ **Last modification**: File freshness

**Scoring criteria:**
- File exists and accessible (0-20 points)
- Content structure (markdown sections) (0-20 points)
- AI-specific guidelines provided (0-20 points)
- Business relevance and clarity (0-20 points)
- Content freshness (0-20 points)

#### 2. **AI.txt File Analysis**
**What it will check:**
- ✅ **File existence**: `/ai.txt` at website root
- ✅ **AI crawler permissions**: Allow/disallow directives
- ✅ **Bot-specific rules**: GPTBot, ClaudeBot, PerplexityBot
- ✅ **Content usage guidelines**: How AI can use the content
- ✅ **Attribution requirements**: Citation and linking rules

**Scoring criteria:**
- File exists and accessible (0-25 points)
- AI crawler permissions properly configured (0-25 points)
- Clear usage guidelines (0-25 points)
- Attribution requirements specified (0-25 points)

#### 3. **OpenGraph Meta Tags Analysis**
**What it will check:**
- ✅ **Basic presence**: og:title, og:description, og:image, og:url
- ✅ **Content accuracy**: Match with page content
- ✅ **Image optimization**: Proper dimensions and alt text
- ✅ **Social sharing**: Twitter, Facebook, LinkedIn optimization
- ✅ **Business-specific tags**: og:type, og:site_name, business:contact_data

**Scoring criteria:**
- Required meta tags present (0-25 points)
- Content accuracy vs page content (0-25 points)
- Image optimization (0-20 points)
- Social platform coverage (0-15 points)
- Business-specific properties (0-15 points)

#### 4. **Twitter Cards Analysis**
**What it will check:**
- ✅ **Card type**: Summary, photo, product, etc.
- ✅ **Required properties**: twitter:card, twitter:title, twitter:description
- ✅ **Image optimization**: twitter:image, aspect ratios
- ✅ **Twitter handles**: twitter:site, twitter:creator
- ✅ **Content synchronization**: Match with OpenGraph

**Scoring criteria:**
- Card implementation (0-30 points)
- Required properties complete (0-25 points)
- Image optimization (0-20 points)
- Handle verification (0-15 points)
- Cross-platform consistency (0-10 points)

#### 5. **Robots.txt Analysis**
**What it will check:**
- ✅ **File accessibility**: Proper HTTP response
- ✅ **AI crawler permissions**: GPTBot, ClaudeBot, etc.
- ✅ **Sitemap declaration**: XML sitemap location
- ✅ **Crawl-delay settings**: Performance optimization
- ✅ **Directory permissions**: Allow/disallow patterns
- ✅ **User-agent specificity**: Different rules for different bots

**Scoring criteria:**
- File accessibility (0-15 points)
- AI crawler permissions (0-25 points)
- Sitemap declaration (0-15 points)
- SEO best practices (0-20 points)
- Performance optimization (0-15 points)
- Security considerations (0-10 points)

#### 6. **Sitemap.xml Analysis**
**What it will check:**
- ✅ **File structure**: Valid XML format
- ✅ **URL coverage**: Important pages included
- ✅ **Priority settings**: Homepage priority 1.0
- ✅ **Last modification dates**: Content freshness
- ✅ **Change frequency**: Appropriate update schedules
- ✅ **Image/video sitemaps**: Media content inclusion

**Scoring criteria:**
- XML validity (0-20 points)
- URL coverage completeness (0-25 points)
- Priority optimization (0-20 points)
- Freshness indicators (0-20 points)
- Media content inclusion (0-15 points)

### 🎯 **AEO/GEO Enhancements**

#### 7. **FAQ Schema Enhancement**
**What it will check:**
- ✅ **Question clarity**: Clear, specific questions
- ✅ **Answer completeness**: Comprehensive responses
- ✅ **Structured format**: Proper FAQPage implementation
- ✅ **Answer accuracy**: Match with website content
- ✅ **SEO optimization**: Featured snippet potential

#### 8. **Review Schema Enhancement**
**What it will check:**
- ✅ **Review presence**: Individual and aggregate reviews
- ✅ **Rating consistency**: Match across platforms
- ✅ **Response quality**: Business responses to reviews
- ✅ **Review freshness**: Recent review activity

## 📊 **Analysis Output Format**

Each analysis will provide:
- **✅/❌ Status**: Whether element is implemented
- **📊 Score**: 0-100 performance rating
- **💡 Recommendations**: Specific improvements needed
- **🎯 Impact**: SEO/AEO/GEO benefit level
- **🔧 Implementation**: How to fix issues

## 🏨 **Hospitality-Specific Focus**

For hotel websites, additional checks:
- **Amenity descriptions** in LLM.txt
- **Booking policies** and procedures
- **Local area information** for AI context
- **Guest service guidelines** for AI responses
- **Contact and reservation** information

---

**Ready to create sample files for each analysis type!** Which would you like to see first?
