// Vercel Function entry point for MCP Project Manager
const { ApiServer } = require('../lib/api-server.js');

// Create API server instance
const apiServer = new ApiServer();
const app = apiServer.getApp();

// Export the Express app directly for Vercel
module.exports = app;

// Support ES modules export
module.exports.default = module.exports; 