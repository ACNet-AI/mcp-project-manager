import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { Redis } from "@upstash/redis";

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

// 🚀 Core Fix: Detect GitHub App installation location, use App JWT instead of Installation Token
async function getInstallationAccount(installation_id: string): Promise<{
  account_type: "User" | "Organization";
  account_login: string;
}> {
  const appId = process.env.APP_ID;
  const privateKey = process.env.PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("Missing APP_ID or PRIVATE_KEY environment variables");
  }

  try {
    console.log(
      `[INSTALLATION-DETECTION] Getting installation info for: ${installation_id}`
    );

    // 🔧 Key Fix: Use App JWT instead of Installation Token
    const auth = createAppAuth({
      appId: appId,
      privateKey: privateKey,
    });

    const appAuth = await auth({ type: "app" });
    const octokit = new Octokit({ auth: appAuth.token });

    const installation = await octokit.rest.apps.getInstallation({
      installation_id: parseInt(installation_id),
    });

    const account_type = (installation.data.account as any)?.type as
      | "User"
      | "Organization";
    const account_login = (installation.data.account as any)?.login || "";

    console.log(
      `[INSTALLATION-DETECTION] ✅ App installed on: ${account_type} (${account_login})`
    );
    return { account_type, account_login };
  } catch (error: any) {
    console.error(
      "[INSTALLATION-DETECTION] Failed to get installation info:",
      error.message
    );
    throw new Error(`Failed to get installation info: ${error.message}`);
  }
}

// 🔧 SERVERLESS Fix: OAuth Token retrieval - Only retrieve from Redis
async function getOAuthUserToken(
  installation_id: string,
  username: string
): Promise<string | null> {
  console.log(
    `[OAUTH-SERVERLESS] Attempting to retrieve OAuth token for ${username} (installation: ${installation_id})`
  );

  try {
    // Strategy A: In-memory check within same request cycle (may be effective when called immediately after callback)
    console.log("[OAUTH-SERVERLESS] Checking same-request-cycle memory...");
    const { installationTokens } = await import("./github/callback.js");
    const storedTokens = installationTokens.get(installation_id);

    if (storedTokens?.user_access_token && storedTokens.username === username) {
      console.log(
        `[OAUTH-SERVERLESS] ✅ Found OAuth token in same request cycle for ${username}`
      );
      return storedTokens.user_access_token;
    }

    console.log(
      "[OAUTH-SERVERLESS] ❌ No OAuth token in memory (expected in serverless)"
    );

    // Strategy B: Redis persistent storage retrieval (main strategy)
    console.log("[OAUTH-SERVERLESS] Checking Redis for OAuth token...");

    const redis = createRedisConnection();
    if (!redis) {
      console.warn(
        "[OAUTH-SERVERLESS] Redis not available, skipping persistent storage check"
      );
      return null;
    }

    try {
      const persistedData = await redis.get(`oauth:${installation_id}`);

      if (persistedData) {
        console.log(
          `[REDIS-STORAGE] Raw data from Redis (type: ${typeof persistedData}):`,
          persistedData
        );

        // 🔧 Handle Upstash Redis auto-deserialized data
        let oauthData;
        try {
          if (typeof persistedData === "object" && persistedData !== null) {
            // Upstash already auto-deserialized, use directly
            oauthData = persistedData as {
              access_token: string;
              username: string;
              installation_id: string;
              created_at: number;
              expires_at: number;
            };
            console.log(
              "[REDIS-STORAGE] ✅ Using auto-deserialized data from Upstash"
            );
          } else if (typeof persistedData === "string") {
            // If it's a string, manual parsing needed
            console.log(
              "[REDIS-STORAGE] Manually parsing JSON string:",
              persistedData.substring(0, 100)
            );
            oauthData = JSON.parse(persistedData) as {
              access_token: string;
              username: string;
              installation_id: string;
              created_at: number;
              expires_at: number;
            };
          } else {
            console.warn(
              `[REDIS-STORAGE] Unexpected data type: ${typeof persistedData}, removing`
            );
            await redis.del(`oauth:${installation_id}`);
            return null;
          }
        } catch (parseError: any) {
          console.error(
            "[REDIS-STORAGE] Data processing failed, removing invalid data:",
            parseError.message
          );
          console.error("[REDIS-STORAGE] Invalid data was:", persistedData);
          await redis.del(`oauth:${installation_id}`);
          return null;
        }

        if (oauthData && oauthData.access_token) {
          const now = Date.now();
          if (now < oauthData.expires_at) {
            console.log(
              `[REDIS-STORAGE] ✅ Found valid OAuth token in Redis for ${oauthData.username}`
            );
            console.log(
              `[REDIS-STORAGE] Token expires in ${Math.round((oauthData.expires_at - now) / (24 * 60 * 60 * 1000))} days`
            );
            return oauthData.access_token;
          } else {
            console.log(
              "[REDIS-STORAGE] ❌ OAuth token in Redis is expired, removing..."
            );
            await redis.del(`oauth:${installation_id}`);
          }
        }
      } else {
        console.log(
          `[REDIS-STORAGE] ❌ No OAuth token found in Redis for installation ${installation_id}`
        );
      }
    } catch (redisError) {
      console.error(
        "[REDIS-STORAGE] Failed to retrieve OAuth token from Redis:",
        redisError
      );
    }
  } catch (error: any) {
    console.warn(
      "[OAUTH-SERVERLESS] Memory import failed (normal in serverless):",
      error.message
    );
  }

  // Strategy C: Return null, trigger error
  console.log(
    "[OAUTH-SERVERLESS] OAuth token not available, will throw error for personal repo"
  );
  return null;
}

interface CreateRepoRequest {
  name: string;
  description?: string;
  owner?: string;
  private?: boolean;
  auto_init?: boolean;
  gitignore_template?: string;
  license_template?: string;
}

// 🔧 Fix: Stateless Token retrieval - regenerate each time, solve serverless memory issues
async function getInstallationToken(installation_id: string): Promise<string> {
  const appId = process.env.APP_ID;
  const privateKey = process.env.PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("Missing APP_ID or PRIVATE_KEY environment variables");
  }

  console.log(
    `[SERVERLESS-FIX] Generating fresh Installation Token for: ${installation_id}`
  );

  try {
    const auth = createAppAuth({
      appId: appId,
      privateKey: privateKey,
    });

    const installationAuth = await auth({
      type: "installation",
      installationId: parseInt(installation_id),
    });

    console.log(
      `[SERVERLESS-FIX] Successfully generated Installation Token for: ${installation_id}`
    );
    return installationAuth.token;
  } catch (error: any) {
    console.error(
      "[JWT-ERROR] Failed to generate Installation Token:",
      error.message
    );
    throw new Error(
      `JWT generation failed: ${error.message}. Please check APP_ID and PRIVATE_KEY configuration.`
    );
  }
}

// 🎯 Check account type: User or Organization
async function checkAccountType(
  accountName: string,
  installationToken: string
): Promise<"User" | "Organization"> {
  try {
    const octokit = new Octokit({ auth: installationToken });
    const response = await octokit.rest.users.getByUsername({
      username: accountName,
    });
    return response.data.type as "User" | "Organization";
  } catch (error: any) {
    console.warn(
      `[ACCOUNT-CHECK] Unable to check account type ${accountName}:`,
      error.message
    );
    // Default assume Organization (safer fallback)
    return "Organization";
  }
}

// 🚀 Core Fix: Smart Token selection - based on target account type
async function getAppropriateToken(
  installation_id: string,
  targetOwner?: string
): Promise<{
  token: string;
  auth_type: "user_token" | "installation_token";
  endpoint_type: "org" | "user";
  username?: string;
}> {
  console.log(
    `[TOKEN-SELECTION] 🚀 Smart Token selection for installation ${installation_id}`
  );
  console.log(
    `[TOKEN-SELECTION] Target owner: ${targetOwner || "None (create current user personal repository)"}`
  );

  try {
    // 🚀 Get installation information and tokens
    const installation = await getInstallationAccount(installation_id);
    const installationToken = await getInstallationToken(installation_id);

    console.log(
      `[INSTALLATION] App installation location: ${installation.account_type} (${installation.account_login})`
    );

    if (!targetOwner) {
      // 🎯 Case 1: Create current user's personal repository → need OAuth User Token
      console.log(
        "[TOKEN-SELECTION] ✅ Create personal repository → looking for OAuth User Token"
      );

      try {
        const userToken = await getOAuthUserToken(
          installation_id,
          installation.account_login
        );
        if (userToken) {
          console.log(
            "[TOKEN-SELECTION] 🎯 Found OAuth User Token → create user personal repository"
          );
          return {
            token: userToken,
            auth_type: "user_token",
            endpoint_type: "user",
            username: installation.account_login,
          };
        } else {
          console.warn(
            "[TOKEN-SELECTION] ❌ OAuth Token not available in memory (Serverless environment limitation)"
          );
        }
      } catch (error: any) {
        console.warn(
          "[TOKEN-SELECTION] OAuth Token retrieval failed:",
          error.message
        );
      }

      // 🚨 OAuth Token unavailable - possible reasons
      console.error(
        "[TOKEN-SELECTION] ❌ Cannot create personal repository: OAuth Token unavailable"
      );
      throw new Error(
        "Unable to create personal repository: No valid OAuth permissions found. " +
          "Possible reasons: 1) OAuth authorization not enabled during GitHub App installation, or 2) OAuth token expired. " +
          "Solution: Reinstall GitHub App and ensure OAuth authorization is enabled: " +
          "https://github.com/apps/mcp-project-manager/installations/new?request_user_authorization=true"
      );
    } else {
      // 🎯 Case 2: Create repository for specified owner → simple Token selection
      console.log(
        `[TOKEN-SELECTION] ✅ Specified owner repository: ${targetOwner}`
      );

      const accountType = await checkAccountType(
        targetOwner,
        installationToken
      );
      console.log(`[TOKEN-SELECTION] ${targetOwner} type: ${accountType}`);

      if (accountType === "Organization") {
        // 🏢 Organization repository → use Installation Token + org API
        console.log(
          "[TOKEN-SELECTION] 🏢 Organization repository → Installation Token + org API"
        );
        return {
          token: installationToken,
          auth_type: "installation_token",
          endpoint_type: "org",
          username: targetOwner,
        };
      } else {
        // 👤 Personal account repository → try OAuth, fallback to Installation Token
        console.log(
          "[TOKEN-SELECTION] 👤 Personal account repository → try OAuth Token"
        );

        try {
          const userToken = await getOAuthUserToken(
            installation_id,
            installation.account_login
          );
          if (userToken) {
            console.log(
              "[TOKEN-SELECTION] 🎯 Use OAuth Token to create personal repository"
            );
            return {
              token: userToken,
              auth_type: "user_token",
              endpoint_type: "user",
              username: targetOwner,
            };
          }
        } catch (error: any) {
          console.warn(
            "[TOKEN-SELECTION] OAuth Token retrieval failed:",
            error.message
          );
        }

        // Fallback: Installation Token
        console.log("[TOKEN-SELECTION] 🔄 Use Installation Token fallback");
        return {
          token: installationToken,
          auth_type: "installation_token",
          endpoint_type: "user",
          username: targetOwner,
        };
      }
    }
  } catch (error: any) {
    console.error("[TOKEN-SELECTION] Token selection failed:", error);
    throw new Error(
      `Installation ${installation_id} authentication failed. Please ensure GitHub App is properly installed. ${error.message}`
    );
  }
}

// Repository creation function
async function createRepository(
  token: string,
  repoConfig: CreateRepoRequest,
  endpoint_type: "org" | "user",
  auth_type: "user_token" | "installation_token",
  api_owner?: string // New: actual API call account name
): Promise<any> {
  const octokit = new Octokit({
    auth: token,
  });

  console.log(
    `[REPO-CREATE] Creating ${endpoint_type} repository: ${repoConfig.name} using ${auth_type}`
  );

  try {
    let response;

    if (endpoint_type === "org" && api_owner) {
      // Organization repository - Use Installation Token to create under installed organization
      console.log(
        `[REPO-CREATE] Creating organization repository in: ${api_owner} (App installation account)`
      );
      response = await octokit.rest.repos.createInOrg({
        org: api_owner,
        name: repoConfig.name,
        description: repoConfig.description,
        private: repoConfig.private || false,
        auto_init: repoConfig.auto_init !== false,
        gitignore_template: repoConfig.gitignore_template,
        license_template: repoConfig.license_template,
      });
    } else {
      // Personal repository - Prefer User Token, fallback to Installation Token
      console.log(
        `[REPO-CREATE] Creating user repository using ${auth_type === "user_token" ? "OAuth User Token" : "Installation Token (fallback)"}`
      );
      response = await octokit.rest.repos.createForAuthenticatedUser({
        name: repoConfig.name,
        description: repoConfig.description,
        private: repoConfig.private || false,
        auto_init: repoConfig.auto_init !== false,
        gitignore_template: repoConfig.gitignore_template,
        license_template: repoConfig.license_template,
      });
    }

    console.log(
      `[REPO-CREATE] Repository created successfully: ${response.data.full_name}`
    );
    return response.data;
  } catch (error: any) {
    console.error("[REPO-CREATE] Failed to create repository:", error);

    if (error.response?.status === 422) {
      const apiMessage = error.response?.data?.message || "";

      // Handle repository name already exists case
      if (
        apiMessage.includes("already exists") ||
        apiMessage.includes("name already exists")
      ) {
        const suggestions = [
          `Try: ${repoConfig.name}-${Date.now().toString().slice(-6)}`,
          `Try: ${repoConfig.name}-v2`,
          `Try: my-${repoConfig.name}`,
          `Try: ${repoConfig.name}-new`,
        ];

        throw new Error(
          `Repository name '${repoConfig.name}' already exists. ${apiMessage}. Suggestions: ${suggestions.slice(0, 2).join(", ")}`
        );
      }

      // Handle other 422 errors
      if (apiMessage.includes("Invalid repository name")) {
        throw new Error(
          `Invalid repository name '${repoConfig.name}'. Repository names can only contain alphanumeric characters, hyphens, periods, and underscores. ${apiMessage}`
        );
      }

      // Generic 422 error
      throw new Error(
        `Repository creation failed: ${apiMessage || "Invalid request parameters"}`
      );
    } else if (error.response?.status === 403) {
      throw new Error(
        "Insufficient permissions: The GitHub App may not have repository creation permissions or access to the specified organization"
      );
    } else if (error.response?.status === 401) {
      throw new Error(
        "Authentication failed: Invalid or expired token. Please reinstall the GitHub App."
      );
    } else {
      throw new Error(`Repository creation failed: ${error.message}`);
    }
  }
}

// 🔧 Fix: Manual request body parsing, solve body parsing issues in Vercel environment
async function parseRequestBody(req: VercelRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    if (req.body) {
      // If req.body exists, use it directly
      console.log("[BODY-PARSE] Using existing req.body:", typeof req.body);
      resolve(req.body);
      return;
    }

    // Manually read request body
    let body = "";
    console.log("[BODY-PARSE] Manually reading request body...");

    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        console.log("[BODY-PARSE] Raw body received:", body);
        if (!body) {
          reject(new Error("No body content received"));
          return;
        }

        const parsed = JSON.parse(body);
        console.log(
          "[BODY-PARSE] Successfully parsed JSON:",
          JSON.stringify(parsed)
        );
        resolve(parsed);
      } catch (error) {
        console.error("[BODY-PARSE] JSON parse error:", error);
        reject(error);
      }
    });

    req.on("error", error => {
      console.error("[BODY-PARSE] Request error:", error);
      reject(error);
    });
  });
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, installation-id"
  );
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  // 🔧 Fix: Simplified authentication - only need installation-id
  const installation_id = req.headers["installation-id"] as string;

  if (!installation_id) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: "Missing authentication",
        details:
          "Please provide 'installation-id' in headers. Get one by completing GitHub App installation.",
        usage:
          "curl -H 'installation-id: 12345678' -d '{\"name\":\"repo-name\"}' /api/publish",
        serverless_note:
          "This API now generates fresh tokens on each call, solving serverless memory issues.",
      })
    );
    return;
  }

  console.log(
    `[PUBLISH-API] ${new Date().toISOString()} - Repository creation request`
  );
  console.log(`[PUBLISH-API] Installation ID: ${installation_id}`);
  console.log(
    "[PUBLISH-API] Serverless Fix: Using manual body parsing + fresh token generation"
  );

  // Handle async operations
  (async () => {
    let repoConfig: CreateRepoRequest;

    try {
      // 🔧 Fix: Use manual body parsing, solve request body issues in Vercel environment
      const parsedBody = await parseRequestBody(req);
      repoConfig = parsedBody as CreateRepoRequest;

      console.log(
        "[PUBLISH-API] Successfully parsed request body:",
        JSON.stringify(repoConfig)
      );

      // Validate required fields
      if (!repoConfig || !repoConfig.name) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: "Missing required field",
            details: "Repository name is required",
            usage:
              "curl -H 'installation-id: 12345678' -d '{\"name\":\"my-repo\"}' /api/publish",
            technical_info:
              "Manual body parsing enabled for Vercel environment",
          })
        );
        return;
      }

      console.log(`[PUBLISH-API] Repository: ${repoConfig.name}`);
      console.log(`[PUBLISH-API] Target: ${repoConfig.owner || "personal"}`);
    } catch (error: any) {
      console.error("[PUBLISH-API] Body parsing failed:", error);
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          error: "Invalid request body",
          details: `Request body must be valid JSON: ${error.message}`,
          required_fields: ["name"],
          optional_fields: ["description", "owner", "private", "auto_init"],
          technical_info: "Manual body parsing enabled for Vercel environment",
        })
      );
      return;
    }

    try {
      // 🔧 Fix: Get fresh token, avoid serverless memory issues
      const { token, auth_type, endpoint_type, username } =
        await getAppropriateToken(installation_id, repoConfig.owner);

      // Create repository
      const repository = await createRepository(
        token,
        repoConfig,
        endpoint_type,
        auth_type,
        username
      );

      // Success response
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          repository: {
            id: repository.id,
            name: repository.name,
            full_name: repository.full_name,
            html_url: repository.html_url,
            clone_url: repository.clone_url,
            private: repository.private,
          },
          auth_method: auth_type,
          endpoint_used: endpoint_type,
          message: `Repository created successfully using ${auth_type} (${endpoint_type} endpoint)`,
          auth_details:
            auth_type === "user_token"
              ? "OAuth User Token (personal repository)"
              : "Installation Token (organization or fallback)",
          technical_info:
            "Smart token selection with serverless-compatible OAuth fallback mechanism",
        })
      );

      console.log(
        `[PUBLISH-API] Success: ${repository.full_name} created using ${auth_type}`
      );
    } catch (error: any) {
      console.error("[PUBLISH-API] Error:", error);

      // Enhanced error response with serverless context
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: "Repository creation failed",
          details: error.message,
          installation_id: installation_id,
          timestamp: new Date().toISOString(),
          deployment_info: "Fresh token generation (serverless-compatible)",
          solutions: [
            "Verify the GitHub App is properly installed for the target account",
            "Check that the installation ID is correct and active",
            "Ensure the GitHub App has repository creation permissions",
            "For organization repositories, verify the App is installed to the organization",
          ],
          debug_info: {
            token_strategy: "fresh_generation",
            memory_dependency: "none",
            app_id_present: !!process.env.APP_ID,
            private_key_present: !!process.env.PRIVATE_KEY,
          },
        })
      );
    }
  })();
}
