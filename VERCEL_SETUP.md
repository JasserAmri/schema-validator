# Vercel Setup Guide: JavaScript Rendering with Puppeteer

This guide explains how to enable JavaScript rendering in your Vercel deployment to detect schemas on JavaScript-heavy sites like the Baume Hotel FAQ page.

## Overview

The schema-validator now supports two rendering methods:
- **Axios** (default): Fast, static HTML fetching
- **Puppeteer** (optional): Full browser rendering with JavaScript execution

## Vercel Configuration Steps

### 1. Install Chrome for Puppeteer in Vercel

Vercel serverless functions need a special Chrome build. You have two options:

#### Option A: Use `@sparticuz/chromium` (Recommended)

This is a pre-built Chromium optimized for serverless environments:

```bash
npm install @sparticuz/chromium puppeteer-core --save
```

Then update `server.js` to use it:

```javascript
// At the top of server.js
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// In renderPageWithJavaScript function, modify launchOptions:
const launchOptions = {
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
};
```

#### Option B: Use Vercel's Chrome Layer (Alternative)

Install the Vercel Chrome integration:

```bash
npm install chrome-aws-lambda --save
```

### 2. Update Environment Variables in Vercel

Go to your Vercel project **Settings → Environment Variables** and add:

```bash
# Enable JavaScript rendering
ENABLE_JS_RENDERING=true

# Timeout for JS rendering (30 seconds)
TIMEOUT_JS_RENDER=30000

# Other existing variables
ENABLE_NON_STANDARD_WARNINGS=true
ENABLE_HTML_CONTENT_ANALYSIS=true
ENABLE_DATE_FRESHNESS_CHECK=true
ENABLE_ENHANCED_BOT_BYPASS=true
TIMEOUT_PAGE=15000
MAX_CONTENT_LENGTH=10485760
```

**Important:** Set these for all environments (Production, Preview, Development)

### 3. Configure Vercel Function Settings

Create or update `vercel.json` in your project root:

```json
{
  "functions": {
    "api/**/*.js": {
      "maxDuration": 60,
      "memory": 1024
    }
  },
  "env": {
    "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD": "true"
  }
}
```

This gives your API functions:
- 60 seconds to complete (JavaScript rendering takes longer)
- 1024MB RAM (Chrome needs memory)

### 4. Update package.json

Ensure your `package.json` has:

```json
{
  "dependencies": {
    "@sparticuz/chromium": "^123.0.0",
    "puppeteer-core": "^21.0.0",
    "axios": "^1.6.0",
    "cheerio": "^1.0.0",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5"
  }
}
```

### 5. Deploy to Vercel

```bash
git add package.json vercel.json
git commit -m "Add Puppeteer support for Vercel"
git push
```

Vercel will automatically redeploy.

## Testing JavaScript Rendering

### Test 1: Check if Puppeteer is Working

```bash
curl -X POST https://your-vercel-url.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.baume-hotel-paris.com/faq/"}'
```

Look for:
- `"renderMethod": "puppeteer"` in the response
- `"allSchemasCount"` should be > 0 for Baume Hotel
- FAQPage schemas should appear in `matched` array

### Test 2: Verify Non-Standard Property Detection

The Baume Hotel FAQ has `dialog_id` properties. Check the response for:

```json
{
  "matched": [{
    "validation": {
      "nonStandardProperties": [{
        "property": "dialog_id",
        "message": "Non-standard property detected: \"dialog_id\" is not in the official Schema.org vocabulary"
      }]
    }
  }]
}
```

## Troubleshooting

### Problem: "JavaScript rendering error: Failed to launch chrome"

**Solution:** Make sure you're using `@sparticuz/chromium`:

```bash
npm uninstall puppeteer
npm install @sparticuz/chromium puppeteer-core --save
```

### Problem: Timeout errors (504 Gateway Timeout)

**Solution 1:** Increase function timeout in `vercel.json`:

```json
{
  "functions": {
    "api/**/*.js": {
      "maxDuration": 60
    }
  }
}
```

**Solution 2:** Reduce JS render timeout:

```bash
TIMEOUT_JS_RENDER=20000
```

### Problem: Out of memory errors

**Solution:** Increase memory in `vercel.json`:

```json
{
  "functions": {
    "api/**/*.js": {
      "memory": 3008
    }
  }
}
```

### Problem: Still seeing 0 schemas

**Check 1:** Verify `ENABLE_JS_RENDERING=true` is set in Vercel environment variables

**Check 2:** Check the response for `"renderMethod": "puppeteer"`

If it says `"renderMethod": "axios"`, JavaScript rendering is not working.

**Check 3:** Check Vercel function logs for errors:
- Go to Vercel Dashboard → Your Project → Functions
- Click on your API function
- Check the logs for Puppeteer errors

## Cost Implications

JavaScript rendering is more expensive:

| Method | Execution Time | Memory | Cost (Vercel Pro) |
|--------|---------------|---------|-------------------|
| Axios | ~200ms | 256MB | ~$0.000001/request |
| Puppeteer | ~5-10s | 1024MB | ~$0.00005/request |

**Recommendation:** Only enable `ENABLE_JS_RENDERING=true` when needed for JavaScript-heavy sites.

## Alternative: Selective JS Rendering

You can modify the code to only use Puppeteer for specific domains:

```javascript
async function shouldUseJSRendering(url) {
  const jsHeavySites = [
    'baume-hotel-paris.com',
    'booking.com',
    'airbnb.com'
  ];

  return jsHeavySites.some(domain => url.includes(domain));
}

// In the analyze endpoint:
const jsRenderResult = await (shouldUseJSRendering(pageUrl)
  ? renderPageWithJavaScript(pageUrl)
  : null);
```

## Verifying Setup

After deploying, test with:

```bash
# Should use Puppeteer (JS rendering enabled)
curl -X POST https://your-url.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.baume-hotel-paris.com/faq/"}' | jq '.renderMethod'

# Expected: "puppeteer"
```

## Support

If you encounter issues:

1. Check Vercel function logs
2. Verify environment variables are set
3. Test locally with `ENABLE_JS_RENDERING=true node server.js`
4. Check package.json has correct dependencies

## Summary Checklist

- [ ] Install `@sparticuz/chromium` and `puppeteer-core`
- [ ] Update server.js to use chromium.executablePath()
- [ ] Add environment variables in Vercel
- [ ] Create/update vercel.json with memory and timeout settings
- [ ] Deploy and verify `renderMethod: "puppeteer"` in response
- [ ] Test with Baume Hotel FAQ page
