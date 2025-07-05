// Vercel Function entry point for MCP Project Manager
const { ApiServer } = require('../lib/api-server.js');

// Create API server instance
const apiServer = new ApiServer();
const app = apiServer.getApp();

// Export Vercel Function handler
module.exports = async (req, res) => {
  try {
    // Set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    // Pass request to Express app
    return app(req, res);
  } catch (error) {
    console.error('Vercel function error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred'
    });
  }
};

// Support ES modules export
module.exports.default = module.exports; 