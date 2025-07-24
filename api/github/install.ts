import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 🔓 PUBLIC API - No authentication required for installation URL generation
  // This API must be publicly accessible for CLI automation to work
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  // Get project name (optional)
  const projectName = req.query?.project_name as string;

  // Generate unique request ID for tracking installation completion
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(
    `[INSTALL-DEBUG] ${new Date().toISOString()} - GitHub App install request`
  );
  console.log(`[INSTALL-DEBUG] Request ID: ${requestId}`);
  console.log(`[INSTALL-DEBUG] Project: ${projectName || "default"}`);

  // GitHub App installation URL
  // User will be redirected to /api/auth/installation-callback after completing installation
  const installUrl =
    "https://github.com/apps/mcp-project-manager/installations/new";

  // Build state parameter for tracking
  const state = JSON.stringify({
    request_id: requestId,
    timestamp: Date.now(),
    action: "install_app",
    project_name: projectName || "mcp-project",
  });

  // 🔧 Fix: Add OAuth authorization request, get User Access Token for personal repository creation
  const fullInstallUrl = `${installUrl}?state=${encodeURIComponent(state)}&request_user_authorization=true`;

  console.log(`[INSTALL-DEBUG] Install URL generated: ${installUrl}`);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(
    JSON.stringify({
      success: true,
      install_url: fullInstallUrl,
      request_id: requestId, // For polling completion status
      polling_interval: 5, // 🆕 Recommended polling interval in seconds
      app_name: "mcp-project-manager",
      message:
        "Please install the GitHub App to authorize repository creation.",
      instructions: [
        "1. Click the install_url to open GitHub App installation page",
        "2. Choose which repositories to grant access (or all repositories)",
        "3. Click 'Install' to complete the process",
        "4. The system will automatically detect completion", // 🆕 Updated instruction
      ],
      automation: {
        polling_endpoint: "/api/github/installation-status",
        polling_parameter: "request_id",
        expected_flow:
          "No manual input required - system will auto-detect completion",
      },
    })
  );
}
