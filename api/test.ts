import { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Vercel API function for testing
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      success: true,
      message: "MCP Project Manager API is working",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      version: "1.0.0",
      endpoints: [
        "GET /api/health - Health check endpoint for monitoring",
        "GET /api/test - Test endpoint with detailed information",
        "POST /api/publish - Submit MCP project for registration",
        "POST /api/github/webhooks - GitHub Webhook endpoint",
      ],
      github_app: {
            app_id: process.env.APP_ID ? "configured" : "missing",
    webhook_secret: process.env.WEBHOOK_SECRET ? "configured" : "missing",
    private_key: process.env.PRIVATE_KEY ? "configured" : "missing",
      },
    })
  );
} 