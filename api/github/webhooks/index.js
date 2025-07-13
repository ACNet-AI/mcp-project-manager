// GitHub Webhooks handler for Vercel
const { createNodeMiddleware, createProbot } = require("probot");
const app = require("../../../lib/src/index.js").default;

const probot = createProbot();

module.exports = createNodeMiddleware(app, {
  probot,
  webhooksPath: "/api/github/webhooks",
});
