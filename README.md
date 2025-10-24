# Schema.org Validator

# 🏨 **Complete SEO/AEO/GEO Analyzer**

A comprehensive web application that analyzes websites for complete SEO, AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization) performance. Goes far beyond basic Schema.org validation to provide professional-grade analysis across 9 categories.

## 🌟 **Features Overview**

### **📊 Schema.org Analysis (Enhanced)**
- **Multi-format detection**: JSON-LD, Microdata, RDFa
- **Target schema matching**: Hotel, LodgingBusiness, FAQPage, Organization, Review, AggregateRating
- **Advanced validation**: Complete Schema.org specification compliance checking
- **Documentation integration**: Direct links to official Schema.org documentation

### **🤖 AI SEO Analysis (5 Categories)**
- **robots.txt analysis**: AI crawler permissions, sitemap declarations, technical optimization
- **llm.txt analysis**: AI content guidelines, business information, usage instructions
- **OpenGraph optimization**: Social media sharing, hotel-specific properties
- **ai.txt analysis**: AI crawler permissions and content usage guidelines
- **sitemap.xml analysis**: XML validation, URL priority optimization, indexing structure

### **🎯 AEO/GEO Analysis (4 Categories)**
- **FAQ/HowTo Schema**: Voice search optimization, featured snippet potential
- **Breadcrumb Navigation**: Site structure validation, navigation hierarchy
- **Content Structure**: AI-friendly formatting, header hierarchy, readability
- **JSON-LD @graph**: Complex schema relationships, cross-references, entity mapping

## 🚀 **Professional Analysis Results**

**9 Comprehensive Analysis Sections:**

1. ✅ **Schema.org Validation** - Complete structured data compliance
2. ✅ **Robots.txt Analysis** - AI crawler optimization
3. ✅ **LLM.txt Analysis** - AI content guidelines
4. ✅ **OpenGraph Analysis** - Social media optimization
5. ✅ **AI.txt Analysis** - AI crawler permissions
6. ✅ **Sitemap.xml Analysis** - Search engine indexing
7. ✅ **FAQ/HowTo Analysis** - Voice search optimization
8. ✅ **Breadcrumb Analysis** - Site navigation structure
9. ✅ **Content Structure** - AI-friendly formatting
10. ✅ **JSON-LD @graph** - Advanced schema relationships

**Each section provides:**
- 🎨 **Color-coded scoring** (0-100 points)
- ⚠️ **Detailed issues** with specific problems
- 💡 **Actionable recommendations** with implementation guidance
- 📖 **Schema.org documentation links**
- 🔍 **Visual analytics** and detailed breakdowns

## 🏨 **Hospitality Industry Focus**

Specifically optimized for hotel and lodging businesses with:
- **Hotel Schema.org validation** with industry-specific requirements
- **AI crawler optimization** for ChatGPT, Claude, and other AI platforms
- **Social media optimization** for beautiful hotel image sharing
- **Voice search optimization** for "best hotel near [landmark]" queries
- **Review and rating analysis** for trust signal optimization

## 🎯 **Perfect Score Achievement**

**Build websites that score 100/100 across all categories using our:**
- 📋 **Perfect Hotel Website System Prompt** (`PERFECT_HOTEL_PROMPT.md`)
- 🧪 **Comprehensive testing** against all 9 analysis categories
- 📚 **Complete implementation guide** with code examples

## 🛠️ **Tech Stack**

- **Backend**: Node.js + Express + axios + cheerio + cors
- **Frontend**: HTML/CSS/JavaScript (vanilla) with responsive design
- **Analysis Engine**: 9 specialized analysis modules with scoring algorithms
- **Port**: 3000

## 📦 **Installation**

1. **Navigate to project directory:**
   ```bash
   cd schema-validator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## 🚀 **Usage**

1. **Start the analyzer:**
   ```bash
   node server.js
   ```

2. **Open your browser:**
   ```
   http://localhost:3000
   ```

3. **Analyze any website:**
   - Enter URL (e.g., `https://www.baume-hotel-paris.com/`)
   - Click "Analyze" for comprehensive SEO/AEO/GEO analysis
   - View detailed scores, issues, and recommendations

## 📊 **API Endpoint**

**POST /api/analyze**

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "url": "https://example.com",
  "validation": {
    "averageScore": 85,
    "totalScore": 170,
    "totalMaxScore": 200,
    "schemaCount": 2
  },
  "robotsAnalysis": {
    "score": 85,
    "exists": true,
    "aiCrawlers": ["GPTBot"],
    "sitemapFound": true
  },
  "llmAnalysis": {
    "score": 90,
    "exists": true,
    "contentQuality": "comprehensive"
  },
  "openGraphAnalysis": {
    "score": 75,
    "exists": true,
    "socialCoverage": ["Facebook", "Twitter"]
  },
  "aiAnalysis": {
    "score": 0,
    "exists": false
  },
  "sitemapAnalysis": {
    "score": 95,
    "exists": true,
    "urlCount": 25,
    "xmlValid": true
  },
  "faqHowToAnalysis": {
    "score": 80,
    "exists": true,
    "featuredSnippetPotential": "high"
  },
  "breadcrumbAnalysis": {
    "score": 90,
    "exists": true,
    "depth": 3
  },
  "contentStructureAnalysis": {
    "score": 88,
    "contentDensity": "comprehensive",
    "readabilityScore": 85
  },
  "jsonLdGraphAnalysis": {
    "score": 75,
    "graphComplexity": "medium",
    "schemaTypes": 4
  }
}
```

## 🏗️ **Project Structure**

```
schema-validator/
├── 📋 Documentation
│   ├── README.md (this file)
│   ├── SEO_RESEARCH.md (comprehensive research)
│   ├── HOSPITALITY_VALIDATION.md (hospitality validation)
│   ├── ANALYZER_CHECKS.md (detailed analysis documentation)
│   └── PERFECT_HOTEL_PROMPT.md (perfect website system prompt)
├── ⚙️ Core Application
│   ├── server.js (54KB comprehensive backend)
│   ├── package.json (dependencies)
│   └── public/ (complete frontend)
├── 📄 Sample Files
│   ├── samples/faq-schema.json
│   ├── samples/sitemap.xml
│   ├── samples/opengraph-hotel.html
│   └── samples/llms.txt
└── 📊 Analysis Engine (9 modules)
    ├── Schema.org validation
    ├── Robots.txt analysis
    ├── LLM.txt analysis
    ├── OpenGraph analysis
    ├── AI.txt analysis
    ├── Sitemap.xml analysis
    ├── FAQ/HowTo analysis
    ├── Breadcrumb analysis
    └── Content structure analysis
```

## 🎯 **Perfect Website Creation**

**Use our system prompt to build websites that achieve perfect scores:**

1. **Read the system prompt:** `PERFECT_HOTEL_PROMPT.md`
2. **Implement all requirements** across 9 analysis categories
3. **Test against the analyzer** for comprehensive validation
4. **Achieve 100/100 scores** in all categories

## 🔍 **What Gets Analyzed**

### **Schema.org Compliance**
- Required properties validation
- Data type checking
- Schema.org specification compliance
- Documentation link integration

### **AI SEO Optimization**
- AI crawler permissions (GPTBot, ClaudeBot, etc.)
- Content guidelines for AI systems
- Social media optimization
- Search engine indexing optimization

### **AEO/GEO Enhancement**
- Voice search optimization
- Featured snippet potential
- Content structure for AI understanding
- Schema relationship mapping

## 🚨 **Error Handling**

Comprehensive error handling for:
- Invalid URL formats
- Website access issues (403, 404, 429)
- Network timeouts and connectivity problems
- HTML parsing errors
- JSON validation issues

## 🏆 **Achievement Summary**

**Evolution from basic validator to comprehensive analyzer:**

✅ **Phase 1 Complete:** AI SEO Analysis (5 categories)  
✅ **Phase 2 Complete:** AEO/GEO Analysis (4 categories)  
✅ **Enhanced:** Schema.org validation with documentation  
✅ **Added:** Professional UI with visual analytics  
✅ **Optimized:** Hospitality industry focus  
✅ **Delivered:** Perfect website creation system prompt  

---

**🎉 Ready for professional SEO/AEO/GEO analysis and perfect website creation!**
