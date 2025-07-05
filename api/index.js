// Vercel Function entry point for MCP Project Manager
const { createProbot } = require('probot');
const { ApiServer } = require('../lib/api-server.js');
const probotApp = require('../lib/index.js');

// Create Express app
const express = require('express');
const app = express();

// Create API server instance
const apiServer = new ApiServer();

// Create Probot instance
const probot = createProbot({
  defaults: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY,
    secret: process.env.GITHUB_WEBHOOK_SECRET,
  }
});

// Load the Probot app
probot.load(probotApp);

// Set Probot instance for API server
apiServer.setProbotInstance(probot);

// Handle webhook requests
app.use('/webhooks/github', probot.webhooks.middleware);

// Handle API requests
app.use('/', apiServer.getApp());

// Export the Express app for Vercel
module.exports = app;

// Support ES modules export
module.exports.default = module.exports; 