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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Check automation bypass
  if (checkAutomationBypass(req)) {
    setBypassCookie(req, res);
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Check all required environment variables
  const requiredEnvVars = [
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_REDIRECT_URI",
    "VERCEL_AUTOMATION_BYPASS_SECRET",
  ];

  const envStatus: { [key: string]: boolean } = {};
  const envValues: { [key: string]: string } = {};

  let allPresent = true;

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    envStatus[envVar] = !!value;
    if (value) {
      // For sensitive information, only show first few characters
      if (envVar.includes("SECRET") || envVar.includes("CLIENT_SECRET")) {
        envValues[envVar] = value.substring(0, 8) + "...";
      } else {
        envValues[envVar] = value;
      }
    } else {
      envValues[envVar] = "NOT_SET";
      allPresent = false;
    }
  }

  // Additional check for some potentially useful environment variables
  const optionalEnvVars = ["VERCEL_URL", "VERCEL_ENV", "NODE_ENV"];

  const additionalEnv: { [key: string]: string } = {};
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar];
    additionalEnv[envVar] = value || "NOT_SET";
  }

  const response = {
    status: allPresent ? "SUCCESS" : "MISSING_VARIABLES",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "unknown",
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    requiredVariables: {
      status: envStatus,
      values: envValues,
      allPresent,
    },
    additionalInfo: additionalEnv,
    message: allPresent
      ? "All required environment variables are set"
      : "Some required environment variables are missing",
    missingVariables: requiredEnvVars.filter(v => !envStatus[v]),
  };

  res.status(allPresent ? 200 : 500).json(response);
}
