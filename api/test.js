/**
 * Vercel API function for testing
 */
module.exports = async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      success: true,
      message: "MCP Project Manager API is working",
      timestamp: new Date().toISOString(),
      endpoints: [
        "GET /api/health - Health check endpoint for monitoring",
        "GET /api/test - Test endpoint with detailed information",
        "POST /api/publish - Submit MCP project for registration",
        "POST /api/github/webhooks - GitHub Webhook endpoint",
      ],
    })
  );
};
