// Vercel Function entry point for MCP Project Manager
const express = require('express');
const { ApiServer } = require('../lib/api-server.js');

// Create Express app
const app = express();

// Add basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug endpoint to check environment variables
app.get('/api/debug/env', (req, res) => {
  res.status(200).json({
    hasGitHubAppId: !!process.env.GITHUB_APP_ID,
    hasPrivateKey: !!process.env.GITHUB_PRIVATE_KEY,
    hasWebhookSecret: !!process.env.GITHUB_WEBHOOK_SECRET,
    hasClientId: !!process.env.GITHUB_CLIENT_ID,
    hasClientSecret: !!process.env.GITHUB_CLIENT_SECRET,
    appId: process.env.GITHUB_APP_ID ? 'Set' : 'Missing',
    privateKeyLength: process.env.GITHUB_PRIVATE_KEY ? process.env.GITHUB_PRIVATE_KEY.length : 0,
    timestamp: new Date().toISOString()
  });
});

let apiServer;

try {
  // Create API server instance
  apiServer = new ApiServer();
  console.log('✅ API server initialized');
} catch (error) {
  console.error('❌ Failed to initialize API server:', error);
}

// Mount API routes
if (apiServer) {
  app.use('/', apiServer.getApp());
} else {
  // Emergency fallback
  app.get('/api/status', (req, res) => {
    res.status(500).json({
      status: 'error',
      service: 'MCP Project Manager',
      message: 'API server initialization failed',
      timestamp: new Date().toISOString()
    });
  });
}

// Note: Webhook handling is now done in /api/github/webhooks/index.js
// This follows the standard Probot + Vercel pattern

// Export the Express app for Vercel
module.exports = app;

// Support ES modules export
module.exports.default = module.exports; 