import { VercelRequest, VercelResponse } from "@vercel/node";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 🔓 PUBLIC API - No authentication required for user installations list
  // This API must be publicly accessible for CLI automation to work
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  // Manually parse URL query parameters (req.query may be undefined in Vercel environment)
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const username = url.searchParams.get("username");

  if (!username || typeof username !== "string") {
    res.statusCode = 400;
    return res.end(
      JSON.stringify({
        error: "Username required",
        usage: "GET /api/github/user-installations?username=<username>",
        example: "/api/github/user-installations?username=guyue",
      })
    );
  }

  // Check required environment variables
  const appId = process.env.APP_ID;
  const privateKey = process.env.PRIVATE_KEY;

  if (!appId || !privateKey) {
    res.statusCode = 500;
    return res.end(
      JSON.stringify({
        error: "GitHub App not configured",
        details: "Missing APP_ID or PRIVATE_KEY environment variables",
      })
    );
  }

  try {
    console.log(
      `[USER-INSTALLATIONS] Fetching installations for user: ${username}`
    );

    // Create GitHub App authenticated Octokit instance
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: parseInt(appId),
        privateKey: privateKey.replace(/\\n/g, "\n"),
      },
    });

    // Get all installations for this GitHub App
    const { data: installations } =
      await appOctokit.rest.apps.listInstallations();

    console.log(
      `[USER-INSTALLATIONS] Found ${installations.length} total installations`
    );

    // Filter installations for the specified user
    const userInstallations = installations.filter(installation => {
      const account = installation.account;
      if (!account) return false;

      // Handle both User and Organization accounts
      const accountLogin = "login" in account ? account.login : null;
      return accountLogin === username;
    });

    console.log(
      `[USER-INSTALLATIONS] Found ${userInstallations.length} installations for user: ${username}`
    );

    // Format installations with detailed information
    const formattedInstallations = userInstallations.map(installation => {
      const account = installation.account;

      return {
        id: installation.id.toString(),
        account: {
          login: account && "login" in account ? account.login : "unknown",
          type: account && "type" in account ? account.type : "unknown",
          avatar_url:
            account && "avatar_url" in account ? account.avatar_url : null,
          html_url: account && "html_url" in account ? account.html_url : null,
        },
        permissions: installation.permissions || {},
        events: installation.events || [],
        repository_selection: installation.repository_selection || "selected",
        repositories_url: installation.repositories_url || "unknown",
        created_at: installation.created_at,
        updated_at: installation.updated_at,
        suspended_at: installation.suspended_at,
        suspended_by: installation.suspended_by,
        app_slug: installation.app_slug,
        target_type: installation.target_type,
      };
    });

    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        success: true,
        username,
        installations_count: userInstallations.length,
        installations: formattedInstallations,
        message:
          userInstallations.length > 0
            ? `Found ${userInstallations.length} installation(s) for user ${username}`
            : `No GitHub App installations found for user ${username}`,
        usage_tips: [
          "Use installation.id for publishing repositories",
          "Check installation.permissions for available scopes",
          "repository_selection indicates if all or selected repos are accessible",
        ],
      })
    );
  } catch (error: any) {
    console.error(
      "[USER-INSTALLATIONS] Error fetching user installations:",
      error
    );

    res.statusCode = 500;
    return res.end(
      JSON.stringify({
        error: "Failed to fetch user installations",
        details: error.message,
        username,
        debug_info: {
          error_type: error.constructor.name,
          status: error.status || "unknown",
        },
      })
    );
  }
}
