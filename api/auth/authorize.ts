import { VercelRequest, VercelResponse } from "@vercel/node";
import { createSessionWithId } from "../../src/utils/session.js";

// Check if automation bypass is enabled
function checkAutomationBypass(req: VercelRequest): boolean {
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!bypassSecret) return false;

  // Check HTTP headers
  const headerBypass = req.headers?.["x-vercel-protection-bypass"];
  if (headerBypass === bypassSecret) return true;

  // Check query parameters
  const queryBypass = req.query?.["x-vercel-protection-bypass"];
  if (queryBypass === bypassSecret) return true;

  return false;
}

// Set bypass cookie (optional)
function setBypassCookie(req: VercelRequest, res: VercelResponse): void {
  const setCookie =
    req.headers?.["x-vercel-set-bypass-cookie"] ||
    req.query?.["x-vercel-set-bypass-cookie"];
  if (setCookie) {
    const sameSite = setCookie === "samesitenone" ? "None" : "Lax";
    res.setHeader(
      "Set-Cookie",
      `vercel-protection-bypass=true; SameSite=${sameSite}; Path=/; Max-Age=3600`
    );
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Check automation bypass
  if (checkAutomationBypass(req)) {
    setBypassCookie(req, res);
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  // Check required environment variables
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "Missing GitHub OAuth configuration",
        details:
          "Please check GITHUB_CLIENT_ID and GITHUB_REDIRECT_URI environment variables",
      })
    );
  }

  // Get project name (optional)
  const projectName = req.query?.project_name as string;

  // Generate session ID (timestamp)
  const sessionId = Date.now().toString();
  
  // Create preliminary session (pending OAuth completion)
  // This resolves the timing issue where client checks status before OAuth callback
  const sessionMetadata = {
    ip_address: req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string,
    user_agent: req.headers['user-agent'] as string
  };

  console.log(`[AUTH-DEBUG] ${new Date().toISOString()} - Creating preliminary session`);
  console.log(`[AUTH-DEBUG] Session ID: ${sessionId}`);
  console.log(`[AUTH-DEBUG] Session will expire in 10 minutes if OAuth not completed`);

  // Create preliminary session with temporary token
  const sessionCreated = createSessionWithId(
    sessionId,
    "pending_oauth", // Temporary token until OAuth completes
    "pending", // Temporary username until OAuth completes
    10 * 60 * 1000, // 10 minutes for OAuth completion
    sessionMetadata
  );

  if (!sessionCreated) {
    console.log(`[AUTH-DEBUG] Failed to create preliminary session - ID collision`);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "Failed to create session",
        details: "Session ID already exists",
      })
    );
  }

  console.log(`[AUTH-DEBUG] Preliminary session created successfully: ${sessionId}`);

  // Build state parameter
  const state = JSON.stringify({
    timestamp: parseInt(sessionId), // Use same timestamp as session ID
    action: "create_repo",
    project_name: projectName || "mcp-project",
  });

  // Build GitHub OAuth URL
  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
  githubAuthUrl.searchParams.append("client_id", clientId);
  githubAuthUrl.searchParams.append("redirect_uri", redirectUri);
  githubAuthUrl.searchParams.append("scope", "repo");
  githubAuthUrl.searchParams.append("state", state);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(
    JSON.stringify({
      success: true,
      auth_url: githubAuthUrl.toString(),
      state: state,
      session_id: sessionId, // Return session ID for client use
    })
  );
}
