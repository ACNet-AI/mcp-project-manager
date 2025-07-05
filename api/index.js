// Vercel Function entry point for MCP Project Manager
const express = require('express');
const { ApiServer } = require('../lib/api-server.js');

// Create Express app
const app = express();

// Add basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let apiServer;
let probotApp;

try {
  // Create API server instance
  apiServer = new ApiServer();
  
  // Try to initialize Probot only if environment variables are available
  if (process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY && process.env.GITHUB_WEBHOOK_SECRET) {
    console.log('🔧 Initializing Probot for webhook handling...');
    
    const { createProbot } = require('probot');
    const probotAppModule = require('../lib/index.js');
    
    // Create Probot instance with proper error handling
    const probot = createProbot({
      defaults: {
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
        secret: process.env.GITHUB_WEBHOOK_SECRET,
      }
    });
    
    // Load the Probot app
    probot.load(probotAppModule);
    
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