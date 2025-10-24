const express = require('express');
const path = require('path');
const app = express();

// Import the main server logic
require('../server')(app);

// Export the Express app as a serverless function
module.exports = app;
