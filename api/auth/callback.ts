import { VercelRequest, VercelResponse } from "@vercel/node";

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

// In-memory session storage (consider using Redis for production)
const sessions = new Map<
  string,
  {
    access_token: string;
    username: string;
    expires_at: number;
  }
>();

// Clean up expired sessions
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expires_at) {
      sessions.delete(sessionId);
    }
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

  cleanupExpiredSessions();

  const { code, state } = req.query;

  if (!code || !state) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "Missing required parameters",
        details: "Both code and state parameters are required",
      })
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "Missing GitHub OAuth configuration",
        details:
          "Please check GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI environment variables",
      })
    );
  }

  try {
    // Validate state parameter
    const stateData = JSON.parse(state as string);
    const timeDiff = Date.now() - stateData.timestamp;
    if (timeDiff > 10 * 60 * 1000) {
      // 10 minutes validity
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "State parameter expired",
          details: "Please restart the OAuth flow",
        })
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code as string,
          redirect_uri: redirectUri,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Failed to obtain access token",
          details: tokenData.error_description || "Unknown error",
        })
      );
    }

    // Get user information
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const userData = await userResponse.json();

    if (!userData.login) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Failed to fetch user information",
          details: userData.message || "Unknown error",
        })
      );
    }

    // Generate session ID
    const sessionId = generateSessionId();
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours validity

    // Store session
    sessions.set(sessionId, {
      access_token: tokenData.access_token,
      username: userData.login,
      expires_at: expiresAt,
    });

    // Return success page
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html");
    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Authorization Successful</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .success { background-color: #d4edda; color: #155724; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info { background-color: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 5px; margin: 15px 0; }
          code { background-color: #f8f9fa; padding: 2px 6px; border-radius: 3px; }
          button { background-color: #007bff; color: white; border: none; padding: 10px 20px; margin: 10px 0; border-radius: 5px; cursor: pointer; }
          button:hover { background-color: #0056b3; }
        </style>
      </head>
      <body>
        <h1>🎉 GitHub OAuth Authorization Successful</h1>
        
        <div class="success">
          <h3>Authorization Information</h3>
          <p><strong>Username:</strong> ${userData.login}</p>
          <p><strong>Session ID:</strong> <code id="sessionId">${sessionId}</code></p>
          <p><strong>Expires At:</strong> ${new Date(expiresAt).toLocaleString()}</p>
        </div>
        
        <div class="info">
          <h3>Next Steps</h3>
          <p>1. Copy the Session ID above</p>
          <p>2. Use it in API calls with Header: <code>session-id: ${sessionId}</code></p>
          <p>3. You can now use <code>/api/publish</code> to create repositories</p>
        </div>
        
        <button onclick="copySessionId()">Copy Session ID</button>
        <button onclick="testApi()">Test API</button>
        
        <script>
          function copySessionId() {
            const sessionId = document.getElementById('sessionId').textContent;
            navigator.clipboard.writeText(sessionId).then(() => {
              alert('Session ID copied to clipboard');
            });
          }
          
          function testApi() {
            const sessionId = document.getElementById('sessionId').textContent;
            window.open('/api/test-oauth?session_id=' + sessionId, '_blank');
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "OAuth callback failed",
        details: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// 生成随机的session ID
function generateSessionId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Date.now().toString(36)
  );
}
