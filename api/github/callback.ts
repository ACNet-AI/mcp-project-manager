import { VercelRequest, VercelResponse } from "@vercel/node";
import { URL } from "url";
import { createAppAuth } from "@octokit/auth-app";
// Removed installation-check.ts - polling status update functionality temporarily removed
import { Redis } from "@upstash/redis";
import { renderTemplate, createCallbackTemplateData } from "../../src/utils/template.js";

// 🔧 Redis Connection Configuration - Use correct REST API environment variables
function createRedisConnection() {
  const redisUrl = process.env.KV_REST_API_URL; // Must be HTTPS REST API URL
  const redisToken = process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    console.warn(
      "Missing Redis REST API environment variables. OAuth tokens cannot be persisted."
    );
    console.warn("Required: KV_REST_API_URL and KV_REST_API_TOKEN");
    return null;
  }

  console.log(
    `[REDIS-CONFIG] Using REST API URL: ${redisUrl.substring(0, 30)}...`
  );

  return new Redis({
    url: redisUrl,
    token: redisToken,
  });
}

// 🎯 Fixed Token storage: Store both Installation Token and User Access Token
const installationTokens = new Map<
  string,
  {
    installation_id: string;
    installation_token?: string; // GitHub App Installation Token
    user_access_token?: string; // OAuth User Access Token
    username?: string;
    created_at: number;
    expires_at: number;
  }
>();

// Enhanced query parameter extraction
function extractQueryParams(req: VercelRequest): Record<string, string> {
  const params: Record<string, string> = {};

  if (req.query && typeof req.query === "object") {
    for (const [key, value] of Object.entries(req.query)) {
      if (value) {
        params[key] = Array.isArray(value) ? value[0] : String(value);
      }
    }
  }

  if (Object.keys(params).length === 0 && req.url) {
    try {
      const urlToParse = req.url.startsWith("http")
        ? req.url
        : `https://example.com${req.url}`;

      const url = new URL(urlToParse);
      url.searchParams.forEach((value, key) => {
        if (value) {
          params[key] = value;
        }
      });
    } catch (error) {
      console.log("[CALLBACK-DEBUG] URL parsing failed:", error);
    }
  }

  return params;
}

// 🔧 Fix: Get Installation Token
async function getInstallationToken(installation_id: string): Promise<string> {
  const appId = process.env.APP_ID;
  const privateKey = process.env.PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("Missing APP_ID or PRIVATE_KEY environment variables");
  }

  console.log(
    `[INSTALLATION-TOKEN] Getting Installation Token for: ${installation_id}`
  );

  const auth = createAppAuth({
    appId: appId,
    privateKey: privateKey,
  });

  const installationAuth = await auth({
    type: "installation",
    installationId: parseInt(installation_id),
  });

  console.log(
    `[INSTALLATION-TOKEN] Successfully obtained Installation Token for: ${installation_id}`
  );
  return installationAuth.token;
}

// OAuth code exchange for User Access Token
async function exchangeCodeForUserToken(
  code: string,
  state: string
): Promise<{
  access_token: string;
  username: string;
}> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variables"
    );
  }

  console.log("[OAUTH-DEBUG] Exchanging code for user access token");

  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "MCP-Project-Manager-App",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        state: state,
      }),
    }
  );

  if (!tokenResponse.ok) {
    throw new Error(
      `Failed to exchange code: ${tokenResponse.status} ${tokenResponse.statusText}`
    );
  }

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    throw new Error(
      `OAuth error: ${tokenData.error_description || tokenData.error}`
    );
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "MCP-Project-Manager-App",
    },
  });

  if (!userResponse.ok) {
    throw new Error(
      `Failed to get user info: ${userResponse.status} ${userResponse.statusText}`
    );
  }

  const userData = await userResponse.json();

  console.log(`[OAUTH-DEBUG] User information obtained: ${userData.login}`);

  return {
    access_token: tokenData.access_token,
    username: userData.login,
  };
}

// 🔧 Fix: Store Installation Token and User Access Token + KV persistence
async function storeInstallationTokens(
  installation_id: string,
  userToken?: {
    access_token: string;
    username: string;
  }
) {
  const now = Date.now();

  try {
    // 🎯 Key fix: Get Installation Token
    const installationToken = await getInstallationToken(installation_id);

    // Store in memory (available within same request cycle)
    installationTokens.set(installation_id, {
      installation_id,
      installation_token: installationToken, // 🔧 Fix: Add Installation Token
      user_access_token: userToken?.access_token,
      username: userToken?.username,
      created_at: now,
      expires_at: now + 24 * 60 * 60 * 1000, // 24 hours
    });

    // 🚀 New: Only store OAuth Token to Redis persistent storage
    // Installation Token not stored, because it can be regenerated anytime via APP_ID+PRIVATE_KEY
    if (userToken?.access_token) {
      const redis = createRedisConnection();
      if (!redis) {
        console.warn(
          "[REDIS-STORAGE] Redis not available, OAuth token will not be persisted"
        );
        return;
      }

      try {
        // 🔧 Detailed debugging: Check data format
        const dataToStore = {
          access_token: userToken.access_token,
          username: userToken.username,
          installation_id,
          created_at: now,
          expires_at: now + 30 * 24 * 60 * 60 * 1000, // 30 days expiration
        };

        try {
          const jsonString = JSON.stringify(dataToStore);
          await redis.set(`oauth:${installation_id}`, jsonString, {
            ex: 30 * 24 * 60 * 60, // 30 days expiration
          });
          console.log(
            `[REDIS-STORAGE] ✅ OAuth Token stored to Redis for ${userToken.username}`
          );
        } catch (error: any) {
          console.error(
            "[REDIS-STORAGE] Failed to serialize or store OAuth token:",
            error.message
          );
          throw error;
        }

        console.log(
          "[REDIS-STORAGE] Installation Token not stored (can be generated statelessly)"
        );
      } catch (redisError) {
        console.error(
          "[REDIS-STORAGE] Failed to store OAuth token:",
          redisError
        );
        // Don't throw error, allow continuing with memory storage
      }
    } else {
      console.log(
        "[REDIS-STORAGE] ⚠️ Only obtained Installation Token, no OAuth Token storage"
      );
    }

    console.log(
      `[TOKEN-STORAGE] Installation ${installation_id} complete tokens stored:`
    );
    console.log("[TOKEN-STORAGE] - Installation Token: ✅ Obtained");
    console.log(
      `[TOKEN-STORAGE] - User Token: ${userToken ? "✅ Obtained (+ KV stored)" : "❌ Not available"}`
    );
    console.log(
      `[TOKEN-STORAGE] - Username: ${userToken?.username || "unknown"}`
    );
  } catch (error) {
    console.error(
      `[TOKEN-STORAGE] Failed to get Installation Token for ${installation_id}:`,
      error
    );

    // Store OAuth Token (if available), Installation Token failure doesn't affect OAuth storage
    if (userToken?.access_token) {
      const redis = createRedisConnection();
      if (!redis) {
        console.warn(
          "[REDIS-STORAGE] Redis not available, OAuth token will not be persisted despite Installation Token failure"
        );
        return;
      }

      try {
        const dataToStore = {
          access_token: userToken.access_token,
          username: userToken.username,
          installation_id,
          created_at: now,
          expires_at: now + 30 * 24 * 60 * 60 * 1000,
        };

        const jsonString = JSON.stringify(dataToStore);
        await redis.set(`oauth:${installation_id}`, jsonString, {
          ex: 30 * 24 * 60 * 60,
        });
        console.log(
          "[REDIS-STORAGE] ✅ OAuth Token stored despite Installation Token failure"
        );
      } catch (redisError) {
        console.error(
          "[REDIS-STORAGE] Failed to store OAuth token:",
          redisError
        );
      }
    }

    installationTokens.set(installation_id, {
      installation_id,
      user_access_token: userToken?.access_token,
      username: userToken?.username,
      created_at: now,
      expires_at: now + 24 * 60 * 60 * 1000,
    });

    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  const queryParams = extractQueryParams(req);

  const installation_id = queryParams.installation_id;
  const setup_action = queryParams.setup_action;
  const code = queryParams.code;
  const state = queryParams.state;

  console.log(
    `[UNIFIED-CALLBACK] ${new Date().toISOString()} - GitHub callback received`
  );
  console.log(
    `[UNIFIED-CALLBACK] Installation ID: ${installation_id}, Code: ${!!code}, Setup Action: ${setup_action}`
  );

  // Parse state parameter
  let stateData = null;
  if (state) {
    try {
      stateData = JSON.parse(decodeURIComponent(state));
      console.log("[UNIFIED-CALLBACK] Parsed state:", stateData);
    } catch (error) {
      console.log("[UNIFIED-CALLBACK] Failed to parse state:", error);
    }
  }

  // 🎯 Unified GitHub App installation + OAuth authorization flow
  if (setup_action === "install") {
    if (!installation_id) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Missing installation ID",
          details:
            "GitHub App installation completed but no installation_id received",
        })
      );
    }

    console.log(
      `[UNIFIED-CALLBACK] GitHub App installation successful: ${installation_id}`
    );

    let username = "unknown";
    let hasUserToken = false;
    let userTokenData = null;
    let installationTokenObtained = false;

    // 🔧 Fix: OAuth processing
    if (code) {
      try {
        console.log(
          "[UNIFIED-CALLBACK] OAuth code present - exchanging for User Access Token"
        );
        userTokenData = await exchangeCodeForUserToken(code, state || "");
        username = userTokenData.username;
        hasUserToken = true;
        console.log(`[UNIFIED-CALLBACK] OAuth successful! User: ${username}`);
      } catch (error) {
        console.error("[UNIFIED-CALLBACK] OAuth exchange failed:", error);
        // Continue with Installation-only flow
      }
    } else {
      console.log(
        "[UNIFIED-CALLBACK] No OAuth code present - Installation only mode"
      );
      console.log(
        "[UNIFIED-CALLBACK] Note: To enable OAuth, ensure 'Request user authorization (OAuth) during installation' is enabled in GitHub App settings"
      );
    }

    // 🔧 Fix: Get and store complete tokens
    try {
      await storeInstallationTokens(
        installation_id,
        userTokenData || undefined
      );
      installationTokenObtained = true;
      console.log(
        `[UNIFIED-CALLBACK] All tokens successfully stored for installation: ${installation_id}`
      );
    } catch (error) {
      console.error(
        "[UNIFIED-CALLBACK] Failed to obtain Installation Token:",
        error
      );
      installationTokenObtained = false;
    }

    // Polling status update functionality temporarily removed
    if (stateData?.request_id) {
      console.log(
        `[UNIFIED-CALLBACK] Installation ${installation_id} callback completed for request ${stateData.request_id}`
      );
    }

    // 🎯 Render success page using template system
    try {
      const templateData = createCallbackTemplateData({
        installation_id,
        username,
        hasUserToken,
        installationTokenObtained,
        projectName: stateData?.project_name,
      });

      const html = renderTemplate("callback-success.html", templateData);

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      return res.end(html);
    } catch (templateError) {
      console.error("[TEMPLATE-ERROR] Failed to render callback page:", templateError);
      
      // Fallback to simple success page
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      return res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Installation Successful</title></head>
        <body>
          <h1>🎉 GitHub App Installation Successful!</h1>
          <p><strong>Installation ID:</strong> ${installation_id}</p>
          <p><strong>Username:</strong> ${username}</p>
          <p><strong>Status:</strong> ${installationTokenObtained ? "Complete" : "Partial"}</p>
          <p>You can now use the Installation ID to create repositories.</p>
        </body>
        </html>
      `);
    }
  } else {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "Invalid callback parameters",
        details:
          "Expected GitHub App installation callback with setup_action=install",
      })
    );
  }
}

// Export token storage for API use
export { installationTokens };
