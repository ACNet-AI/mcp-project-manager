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

// Validate session ID format and expiry (stateless)
function validateSessionFormat(sessionId: string): { valid: boolean; status: string; expires_at?: number } {
  try {
    // Session ID should be a timestamp
    const timestamp = parseInt(sessionId);
    
    if (isNaN(timestamp) || timestamp <= 0) {
      return { valid: false, status: "INVALID_FORMAT" };
    }
    
    const now = Date.now();
    const sessionAge = now - timestamp;
    
    // Check if session is too old (expired)
    const maxAge = 30 * 60 * 1000; // 30 minutes
    if (sessionAge > maxAge) {
      return { valid: false, status: "EXPIRED" };
    }
    
    // Check if session is from future (invalid)
    if (sessionAge < -60000) { // Allow 1 minute clock skew
      return { valid: false, status: "FUTURE_TIMESTAMP" };
    }
    
    return { 
      valid: true, 
      status: "VALID", 
      expires_at: timestamp + maxAge 
    };
  } catch (error) {
    return { valid: false, status: "PARSE_ERROR" };
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

  // Add detailed debugging logs
  console.log(`[SESSION-DEBUG] ${new Date().toISOString()} - Status check request`);
  console.log(`[SESSION-DEBUG] Request headers:`, req.headers);
  console.log(`[SESSION-DEBUG] Request query:`, req.query);
  console.log(`[SESSION-DEBUG] Extracted session ID: ${sessionId} (type: ${typeof sessionId})`);

  if (!sessionId || typeof sessionId !== 'string') {
    console.log(`[SESSION-DEBUG] Session ID validation failed - missing or invalid type`);
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

  // Validate session using stateless approach
  console.log(`[SESSION-DEBUG] Validating session: ${sessionId}`);
  const validation = validateSessionFormat(sessionId);
  
  console.log(`[SESSION-DEBUG] Session validation result:`, {
    sessionId: sessionId,
    valid: validation.valid,
    status: validation.status,
    expires_at: validation.expires_at,
    currentTime: Date.now()
  });

  if (!validation.valid) {
    let errorMessage = "Invalid session";
    switch (validation.status) {
      case "EXPIRED":
        errorMessage = "Session has expired. Please re-authenticate.";
        break;
      case "INVALID_FORMAT":
        errorMessage = "Invalid session format. Please re-authenticate.";
        break;
      case "FUTURE_TIMESTAMP":
        errorMessage = "Invalid session timestamp. Please re-authenticate.";
        break;
      case "PARSE_ERROR":
        errorMessage = "Session parsing error. Please re-authenticate.";
        break;
    }
    
    console.log(`[SESSION-DEBUG] Session validation failed: ${validation.status}`);
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "Invalid or expired session",
        details: errorMessage,
        code: "INVALID_SESSION",
        reason: validation.status,
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

  console.log(`[SESSION-DEBUG] Session status check successful for session: ${sessionId}`);

  // For stateless approach, we assume session is in pending OAuth state
  // until we implement OAuth completion tracking
  
  // Check if OAuth might be completed by examining session age
  // If session is older than 5 minutes, likely OAuth was attempted
  const sessionTimestamp = parseInt(sessionId);
  const sessionAge = Date.now() - sessionTimestamp;
  const oauthTimeoutMs = 5 * 60 * 1000; // 5 minutes
  
  // Simple heuristic: if session is very new (< 30 seconds), definitely pending
  // If session is old (> 5 minutes) without completion, likely failed
  const isPendingOAuth = sessionAge < 30000; // 30 seconds
  const isLikelyExpiredOAuth = sessionAge > oauthTimeoutMs;
  
  if (isPendingOAuth) {
    console.log(`[SESSION-DEBUG] Session in pending OAuth state: ${sessionId}`);
    res.statusCode = 202; // Accepted - processing
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        authorized: false,
        session_id: sessionId,
        status: "pending_oauth",
        message: "Session created, waiting for OAuth completion",
        expires_at: validation.expires_at,
        expires_in: Math.floor((validation.expires_at! - Date.now()) / 1000),
        next_step: "Complete GitHub OAuth authorization",
        code: "PENDING_OAUTH",
        environment: envStatus,
      })
    );
  }

  if (isLikelyExpiredOAuth) {
    console.log(`[SESSION-DEBUG] OAuth likely expired for session: ${sessionId}`);
    res.statusCode = 408; // Request Timeout
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        authorized: false,
        session_id: sessionId,
        status: "oauth_timeout",
        message: "OAuth authorization timed out. Please restart the process.",
        expires_at: validation.expires_at,
        expires_in: Math.floor((validation.expires_at! - Date.now()) / 1000),
        next_step: "Restart OAuth authorization",
        code: "OAUTH_TIMEOUT",
        environment: envStatus,
      })
    );
  }

  // Session is in middle state - could be completed OAuth
  // In a real implementation, this would check actual OAuth completion
  console.log(`[SESSION-DEBUG] Session in intermediate state, assuming OAuth completed: ${sessionId}`);

  // Return session status (this will be reached after OAuth completion)
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(
    JSON.stringify({
      authorized: true,
      session_id: sessionId,
      username: "oauth_user", // Will be filled after OAuth
      expires_at: validation.expires_at,
      created_at: parseInt(sessionId),
      expires_in: Math.floor((validation.expires_at! - Date.now()) / 1000),
      environment: envStatus,
      message: "Session is valid and active",
    })
  );
}
