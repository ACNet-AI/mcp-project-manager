import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

// Create Redis connection
function createRedisConnection() {
  const redisUrl = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  return new Redis({
    url: redisUrl,
    token: redisToken,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  const installation_id = req.query?.installation_id as string;

  if (!installation_id) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ 
      error: "installation_id parameter required",
      query: req.query,
      url: req.url 
    }));
  }

  try {
    const redis = createRedisConnection();
    if (!redis) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: "Redis not available" }));
    }

    // Check if OAuth token exists
    const oauthKey = `oauth:${installation_id}`;
    const oauthData = await redis.get(oauthKey);

    let parsedData = null;
    if (oauthData) {
      try {
        parsedData = typeof oauthData === 'string' ? JSON.parse(oauthData) : oauthData;
      } catch (e) {
        parsedData = { raw: oauthData, parse_error: true };
      }
    }

    const response = {
      installation_id,
      oauth_token_exists: !!oauthData,
      oauth_data: parsedData,
      timestamp: new Date().toISOString(),
    };

    res.statusCode = 200;
    return res.end(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error("OAuth check error:", error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ 
      error: "Failed to check OAuth token",
      message: error instanceof Error ? error.message : "Unknown error"
    }));
  }
}
