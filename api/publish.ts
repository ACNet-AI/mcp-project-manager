import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";

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

// Session storage shared with callback.ts
const sessions = new Map<
  string,
  {
    access_token: string;
    username: string;
    expires_at: number;
  }
>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Check automation bypass
  const isBypass = checkAutomationBypass(req);
  if (isBypass) {
    setBypassCookie(req, res);
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  let session: { access_token: string; username: string; expires_at: number } | null = null;

  // Skip session validation if bypass is enabled
  if (isBypass) {
    // Create a mock session for bypass mode
    session = {
      access_token: process.env.GITHUB_TOKEN || "mock-token",
      username: "test-user",
      expires_at: Date.now() + 3600000, // 1 hour from now
    };
  } else {
    // Get session ID from headers
    const sessionId = req.headers?.["session-id"] as string;

    if (!sessionId) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Missing session ID",
          details: "Please provide session-id in headers",
          code: "MISSING_SESSION_ID",
        })
      );
    }

    // Check if session exists
    session = sessions.get(sessionId) || null;

    if (!session) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Invalid session",
          details: "Session not found or expired",
          code: "INVALID_SESSION",
        })
      );
    }

    // Check if session is expired
    if (Date.now() > session.expires_at) {
      sessions.delete(sessionId);
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Session expired",
          details: "Please re-authenticate",
          code: "SESSION_EXPIRED",
        })
      );
    }
  }

  try {
    const body = req.body;

    // Check request body format
    if (!body || typeof body !== "object") {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Invalid request body",
          details: "Request body must be a valid JSON object",
        })
      );
    }

    // Extract project information
    let projectName: string;
    let projectDescription: string;
    let projectFiles: Record<string, string>;

    // Detect MCP Factory format vs traditional format
    if (body.projectType && body.projectData) {
      // MCP Factory format
      projectName = body.projectData.name;
      projectDescription = body.projectData.description || "MCP server project";
      projectFiles = body.projectData.files || {};
    } else {
      // Traditional format
      projectName = body.name;
      projectDescription = body.description || "GitHub repository";
      projectFiles = body.projectFiles || {};
    }

    // Validate required fields
    if (!projectName) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Missing project name",
          details: "Please provide project name in the request body",
        })
      );
    }

    // Smart convert projectFiles format
    let filesArray: Array<{ path: string; content: string }>;

    if (Array.isArray(projectFiles)) {
      // Already in array format
      filesArray = projectFiles;
    } else if (typeof projectFiles === "object" && projectFiles !== null) {
      // Convert from object to array
      filesArray = Object.entries(projectFiles).map(([path, content]) => ({
        path,
        content:
          typeof content === "string"
            ? content
            : JSON.stringify(content, null, 2),
      }));
    } else {
      // Default files
      filesArray = [
        {
          path: "README.md",
          content: `# ${projectName}\n\n${projectDescription}\n\nCreated via MCP Project Manager`,
        },
      ];
    }

    // Create Octokit instance with User Access Token
    const octokit = new Octokit({
      auth: session.access_token,
    });

    // Create personal repository
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: projectName,
      description: projectDescription,
      private: false,
      auto_init: false,
    });

    // Upload files
    const uploadedFiles = [];
    for (const file of filesArray) {
      if (file.content) {
        try {
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: session.username,
            repo: projectName,
            path: file.path,
            message: `Add ${file.path}`,
            content: Buffer.from(file.content).toString("base64"),
          });
          uploadedFiles.push(file.path);
        } catch (error) {
          console.error(`Failed to upload ${file.path}:`, error);
        }
      }
    }

    // Return success response
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        success: true,
        message: "Repository created successfully",
        method: "user_access_token",
        repository: {
          name: repo.name,
          url: repo.html_url,
          clone_url: repo.clone_url,
          ssh_url: repo.ssh_url,
          owner: repo.owner.login,
          private: repo.private,
          created_at: repo.created_at,
        },
        files: {
          uploaded: uploadedFiles,
          total: filesArray.length,
        },
        user: {
          username: session.username,
          session_expires_at: session.expires_at,
        },
      })
    );
  } catch (error: unknown) {
    console.error("Repository creation failed:", error);

    // Provide detailed error information
    let errorMessage = "Failed to create repository";
    let errorCode = "REPO_CREATION_FAILED";
    let statusCode = 500;

    if (error && typeof error === "object") {
      if ("status" in error) {
        statusCode = error.status as number;
        if (error.status === 401) {
          errorMessage = "GitHub authentication failed";
          errorCode = "GITHUB_AUTH_FAILED";
        } else if (error.status === 403) {
          errorMessage = "Insufficient permissions";
          errorCode = "INSUFFICIENT_PERMISSIONS";
        } else if (error.status === 422) {
          errorMessage = "Repository name already exists or is invalid";
          errorCode = "REPO_NAME_CONFLICT";
        }
      }
    }

    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error",
        code: errorCode,
        github_error: error && typeof error === "object" && "response" in error ? error.response : null,
      })
    );
  }
}
