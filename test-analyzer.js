#!/usr/bin/env node
// Simple test script to verify analyzer functionality
// Run with: node test-analyzer.js

const axios = require('axios');

const TEST_URLS = [
  'https://schema.org',
  'https://example.com',
];

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function testAnalyzer() {
  console.log('🧪 Testing Schema Analyzer API...\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  for (const url of TEST_URLS) {
    try {
      console.log(`Testing: ${url}`);
      const start = Date.now();

      const response = await axios.post(`${BASE_URL}/api/analyze`,
        { url },
        {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const duration = Date.now() - start;

      // Basic validation
      if (response.data &&
          response.data.validation &&
          response.data.robotsAnalysis &&
          response.data.openGraphAnalysis) {
        console.log(`  ✅ PASS (${duration}ms)`);
        console.log(`     - Schemas found: ${response.data.allSchemasCount || 0}`);
        console.log(`     - robots.txt score: ${response.data.robotsAnalysis.score}`);
        console.log(`     - OpenGraph score: ${response.data.openGraphAnalysis.score}\n`);
        passed++;
      } else {
        console.log(`  ❌ FAIL - Incomplete response structure\n`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}\n`);
      failed++;
    }
  }

  console.log('═══════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════\n');

  return failed === 0;
}

// Run tests
testAnalyzer()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Test error:', err.message);
    process.exit(1);
  });
