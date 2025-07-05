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
  
  // Try to initialize Probot only if environment variables are available
  if (process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY && process.env.GITHUB_WEBHOOK_SECRET) {
    console.log('🔧 Initializing Probot for webhook handling...');
    console.log('App ID:', process.env.GITHUB_APP_ID);
    console.log('Private Key length:', process.env.GITHUB_PRIVATE_KEY.length);
    console.log('Webhook Secret set:', !!process.env.GITHUB_WEBHOOK_SECRET);
    
    const { createProbot } = require('probot');
    
    // Set environment variables for Probot (it reads them automatically)
    process.env.APP_ID = process.env.GITHUB_APP_ID;
    process.env.PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY;
    process.env.WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
    
    // Create Probot instance - it will read env vars automatically
    const probot = createProbot();
    
    // Load the Probot app with error handling
    try {
      const probotAppModule = require('../lib/index.js');
      if (typeof probotAppModule === 'function') {
        probot.load(probotAppModule);
        console.log('✅ Probot app loaded successfully');
      } else {
        throw new Error('Probot app module is not a function');
      }
    } catch (loadError) {
      console.error('❌ Failed to load Probot app:', loadError);
      throw loadError;
    }
    
    // Set Probot instance for API server
    apiServer.setProbotInstance(probot);
    
    // Handle webhook requests through Probot
    app.use('/webhooks/github', probot.webhooks.middleware);
    
    console.log('✅ Probot initialized successfully');
    
  } else {
    console.log('⚠️ GitHub App environment variables not found, using fallback webhook handler');
    
    // Fallback webhook handler
    app.post('/webhooks/github', (req, res) => {
      console.log('📡 Received GitHub webhook (fallback mode)');
      res.status(200).json({
        message: 'Webhook received but not processed (missing environment variables)',
        timestamp: new Date().toISOString()
      });
    });
    
    app.get('/webhooks/github', (req, res) => {
      res.status(200).json({
        message: 'GitHub webhook endpoint is ready (fallback mode)',
        service: 'MCP Project Manager',
        note: 'Environment variables required for full functionality',
        timestamp: new Date().toISOString()
      });
    });
  }
  
} catch (error) {
  console.error('❌ Failed to initialize Probot:', error);
  
  // Fallback webhook handler in case of Probot initialization failure
  app.post('/webhooks/github', (req, res) => {
    console.log('📡 Received GitHub webhook (error fallback)');
    res.status(200).json({
      message: 'Webhook received but not processed (initialization error)',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  });
  
  app.get('/webhooks/github', (req, res) => {
    res.status(200).json({
      message: 'GitHub webhook endpoint is ready (error fallback)',
      service: 'MCP Project Manager',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  });
}

// Always mount API routes (even if Probot fails)
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

// Export the Express app for Vercel
module.exports = app;

// Support ES modules export
module.exports.default = module.exports; 