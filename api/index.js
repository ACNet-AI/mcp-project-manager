// Vercel Function entry point
const { ApiServer } = require('../lib/api-server.js');

// Create API server instance
const apiServer = new ApiServer();
const app = apiServer.getApp();

// Export Vercel Function handler
module.exports = (req, res) => {
  return app(req, res);
};

// Support ES modules export
module.exports.default = module.exports; 