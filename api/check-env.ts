import { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Set basic headers
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    const appId = process.env.APP_ID;
    const privateKey = process.env.PRIVATE_KEY;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const nodeEnv = process.env.NODE_ENV;
    const kvRestApiUrl = process.env.KV_REST_API_URL;
    const kvRestApiToken = process.env.KV_REST_API_TOKEN;

    const responseData = {
      environment: nodeEnv || "unknown",
      timestamp: new Date().toISOString(),
      config_status: {
        APP_ID: {
          present: !!appId,
          length: appId?.length || 0,
        },
        PRIVATE_KEY: {
          present: !!privateKey,
          length: privateKey?.length || 0,
        },
        GITHUB_CLIENT_ID: {
          present: !!clientId,
          length: clientId?.length || 0,
        },
        GITHUB_CLIENT_SECRET: {
          present: !!clientSecret,
          length: clientSecret?.length || 0,
        },
        KV_REST_API_URL: {
          present: !!kvRestApiUrl,
          length: kvRestApiUrl?.length || 0,
        },
        KV_REST_API_TOKEN: {
          present: !!kvRestApiToken,
          length: kvRestApiToken?.length || 0,
        },
      },
      oauth_support: {
        enabled: !!(clientId && clientSecret),
        status:
          clientId && clientSecret
            ? "OAuth tokens can be obtained"
            : "OAuth setup incomplete",
      },
      redis_support: {
        enabled: !!(kvRestApiUrl && kvRestApiToken),
        status:
          kvRestApiUrl && kvRestApiToken
            ? "Redis storage available"
            : "Redis configuration incomplete",
      },
      message: "Environment check completed",
    };

    res.statusCode = 200;
    return res.end(JSON.stringify(responseData));
  } catch (error) {
    console.error("Environment check error:", error);
    const errorResponse = {
      error: "Environment check failed",
      message: error instanceof Error ? error.message : "Unknown error",
    };
    res.statusCode = 500;
    return res.end(JSON.stringify(errorResponse));
  }
}
