// server.js
// Schema / SEO / AEO / GEO Analyzer (full, hardened)
// ---------------------------------------------------

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Routes
const analyzeRouter = require('./routes/analyze');
const analyzeSiteRouter = require('./routes/analyzeSite');

// -------------------------------------
// App setup
// -------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' :
          (process.env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim()),
  optionsSuccessStatus: 200
};

// Trust proxy for Vercel deployment (fixes X-Forwarded-For warnings)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', limiter);
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------
// API Route
// -------------------------------------
// Diagnostic endpoint to check environment variables
app.get('/api/debug-env', (req, res) => {
  res.json({
    ENABLE_JS_RENDERING: process.env.ENABLE_JS_RENDERING,
    type: typeof process.env.ENABLE_JS_RENDERING,
    length: process.env.ENABLE_JS_RENDERING?.length,
    isTrue: process.env.ENABLE_JS_RENDERING === 'true',
    allEnableFlags: Object.keys(process.env).filter(k => k.includes('ENABLE'))
  });
});

// Mount analyze routers
app.use('/api', analyzeRouter);
app.use('/api', analyzeSiteRouter);

// -------------------------------------
// Serve UI
// -------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// For local run:
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

// Export for serverless, tests, etc.
module.exports = app;
