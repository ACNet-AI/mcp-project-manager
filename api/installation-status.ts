import { VercelRequest, VercelResponse } from "@vercel/node";
import { createProbot } from "probot";

/**
 * Installation Status endpoint - checks if GitHub App is installed for user
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    // Multiple ways to get the username parameter
    const username =
      (req.query?.username as string) ||
      req.url?.split("?username=")[1]?.split("&")[0];

    // Check if GitHub App environment variables are configured
    const appId = process.env.APP_ID;
    const privateKey = process.env.PRIVATE_KEY;
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!appId || !privateKey || !webhookSecret) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          installed: false,
          error: "GitHub App not properly configured",
          installationUrl:
            "https://github.com/apps/mcp-project-manager/installations/new",
        })
      );
    }

    // If no username provided, return general status
    if (!username) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          installed: false,
          message: "Provide username parameter to check installation status",
          installationUrl:
            "https://github.com/apps/mcp-project-manager/installations/new",
        })
      );
    }

    try {
      // Create Probot instance for API calls
      const probot = createProbot();
      const github = await probot.auth();

      // Try to get installations for the app
      const { data: installations } = await github.apps.listInstallations();

      // Check if user/organization has the app installed
      const userInstallation = installations.find(
        installation =>
          installation.account?.login?.toLowerCase() === username.toLowerCase()
      );

      if (userInstallation && userInstallation.account) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            installed: true,
            installationId: userInstallation.id.toString(),
            account: {
              login: userInstallation.account!.login,
              type: userInstallation.account!.type,
            },
            permissions: userInstallation.permissions,
            installationUrl:
              "https://github.com/apps/mcp-project-manager/installations/new",
          })
        );
      } else {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            installed: false,
            message: `GitHub App not installed for ${username}`,
            installationUrl:
              "https://github.com/apps/mcp-project-manager/installations/new",
          })
        );
      }
    } catch (githubError) {
      console.error("GitHub API error:", githubError);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          installed: false,
          error: "Unable to verify installation status",
          installationUrl:
            "https://github.com/apps/mcp-project-manager/installations/new",
        })
      );
    }
  } catch (error) {
    console.error("Installation status error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        installed: false,
        error: "Internal server error",
        installationUrl:
          "https://github.com/apps/mcp-project-manager/installations/new",
      })
    );
  }
}
