import { VercelRequest, VercelResponse } from "@vercel/node";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 🔓 PUBLIC API - No authentication required for GitHub App detection
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
  const user = url.searchParams.get("user");

  if (!user || typeof user !== "string") {
    res.statusCode = 400;
    return res.end(
      JSON.stringify({
        error: "Username required",
        usage: "GET /api/github/installation-status?user=<username>",
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
      `[INSTALLATION-STATUS] Checking installation status for user: ${user}`
    );

    // Create GitHub App authenticated Octokit instance
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: parseInt(appId!),
        privateKey: privateKey!.replace(/\\n/g, "\n"),
      },
    });

    // Get all installations for this GitHub App
    const { data: installations } =
      await appOctokit.rest.apps.listInstallations();

    console.log(
      `[INSTALLATION-STATUS] Found ${installations.length} total installations`
    );

    // Filter installations for the specified user
    const userInstallations = installations.filter(installation => {
      const account = installation.account;
      if (!account) return false;

      // Handle both User and Organization accounts
      const accountLogin = "login" in account ? account.login : null;
      return accountLogin === user;
    });

    console.log(
      `[INSTALLATION-STATUS] Found ${userInstallations.length} installations for user: ${user}`
    );

    if (userInstallations.length > 0) {
      const formattedInstallations = userInstallations.map(installation => {
        const account = installation.account;
        return {
          id: installation.id.toString(),
          account: account && "login" in account ? account.login : "unknown",
          account_type: account && "type" in account ? account.type : "unknown",
          permissions: Object.keys(installation.permissions || {}),
          repository_selection: installation.repository_selection,
          created_at: installation.created_at,
          updated_at: installation.updated_at,
          app_slug: installation.app_slug,
        };
      });

      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          installed: true,
          username: user,
          installations: formattedInstallations,
          message: `Found ${userInstallations.length} installation(s) for user ${user}`,
        })
      );
    } else {
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          installed: false,
          username: user,
          installations: [],
          message: `No GitHub App installations found for user ${user}`,
          next_steps: [
            "User needs to install the GitHub App",
            "Use GET /api/github/install to get installation URL",
          ],
        })
      );
    }
  } catch (error: any) {
    console.error(
      "[INSTALLATION-STATUS] Error checking installation status:",
      error
    );

    res.statusCode = 500;
    return res.end(
      JSON.stringify({
        error: "Failed to check installation status",
        details: error.message,
        username: user,
        debug_info: {
          error_type: error.constructor.name,
          status: error.status || "unknown",
        },
      })
    );
  }
}
