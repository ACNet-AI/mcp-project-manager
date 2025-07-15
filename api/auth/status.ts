import { VercelRequest, VercelResponse } from "@vercel/node";
import { validateSession, getSessionCount } from "../../src/utils/session.js";

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

  // Get session ID from headers or query parameters
  const sessionId = req.headers?.["session-id"] || req.query?.["session-id"];

  if (!sessionId || typeof sessionId !== 'string') {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "Missing session ID",
        details: "Please provide session-id in headers or query parameters",
        code: "MISSING_SESSION_ID",
      })
    );
  }

  // Validate session using shared session storage
  const session = validateSession(sessionId);

  if (!session) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "Invalid or expired session",
        details: "Session not found or has expired. Please re-authenticate.",
        code: "INVALID_SESSION",
      })
    );
  }

  // Check environment variables status
  const envStatus = {
    github_client_id: !!process.env.GITHUB_CLIENT_ID,
    github_client_secret: !!process.env.GITHUB_CLIENT_SECRET,
    github_redirect_uri: !!process.env.GITHUB_REDIRECT_URI,
    vercel_automation_bypass: !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  };

  // Return session status
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(
    JSON.stringify({
      authorized: true,
      session_id: sessionId,
      username: session.username,
      expires_at: session.expires_at,
      created_at: session.created_at,
      expires_in: Math.floor((session.expires_at - Date.now()) / 1000),
      environment: envStatus,
      total_sessions: getSessionCount(),
      message: "Session is valid and active",
    })
  );
}
