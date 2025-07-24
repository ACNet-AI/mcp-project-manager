import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { ProbotContext, FileContent, RepositoryCreateOptions } from "./types.js";
import { MCPProjectRegistration } from "./types.js";

/**
 * GitHub API utility functions
 */

/**
 * Validate and process private key from environment
 */
function validatePrivateKey(privateKey: string): string {
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }
  
  // Handle newline escaping issues common in deployment environments
  const processedKey = privateKey.replace(/\\n/g, '\n');
  
  // Basic validation - check for required PEM format
  if (!processedKey.includes('-----BEGIN') || !processedKey.includes('-----END')) {
    throw new Error("PRIVATE_KEY must be in valid PEM format");
  }
  
  return processedKey;
}

/**
 * Validate environment variables
 */
function validateEnvironment(): { appId: string; privateKey: string } {
  const appId = process.env.APP_ID;
  const privateKey = process.env.PRIVATE_KEY;

  if (!appId) {
    throw new Error("APP_ID environment variable is required");
  }

  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  // Validate APP_ID is numeric
  if (!/^\d+$/.test(appId)) {
    throw new Error("APP_ID must be a numeric value");
  }

  return {
    appId,
    privateKey: validatePrivateKey(privateKey)
  };
}

/**
 * Get repository information from context
 */
export function getRepoInfo(context: ProbotContext) {
  const payload = context.payload;
  const repository = 'repository' in payload ? payload.repository : null;

  if (!repository || !repository.owner) {
    throw new Error("Repository information is missing from payload");
  }

  return {
    owner: repository.owner.login,
    repo: repository.name,
    fullName: `${repository.owner.login}/${repository.name}`,
  };
}

/**
 * Get Installation Token for Hub repository
 */
async function getHubInstallationToken(): Promise<string> {
  const { appId, privateKey } = validateEnvironment();

  try {
    const auth = createAppAuth({
      appId: appId,
      privateKey: privateKey,
    });

    // First get App token to query installation info
    const appAuth = await auth({ type: "app" });
    const appOctokit = new Octokit({ auth: appAuth.token });

    // Find ACNet-AI/mcp-servers-hub installation
    const installations = await appOctokit.rest.apps.listInstallations();

    for (const installation of installations.data) {
      if (installation.account?.login === "ACNet-AI") {
        // Get Installation Token for this installation
        const installationAuth = await auth({
          type: "installation",
          installationId: installation.id,
        });

        return installationAuth.token;
      }
    }

    throw new Error(
      "MCP Project Manager is not installed on ACNet-AI organization"
    );
  } catch (error) {
    throw new Error(
      `Failed to get Hub Installation Token: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create user repository (Account permissions)
 */
export async function createUserRepository(
  context: ProbotContext,
  repoName: string,
  options: RepositoryCreateOptions = {}
) {
  try {
    const response = await context.octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: options.description || `MCP server project: ${repoName}`,
      private: options.private !== undefined ? options.private : false,
      auto_init: options.autoInit !== undefined ? options.autoInit : true,
      gitignore_template: options.gitignoreTemplate || "Node",
      license_template: options.licenseTemplate || "mit",
    });

    context.log.info(
      `✅ Repository created successfully: ${response.data.full_name}`
    );
    return response.data;
  } catch (error) {
    context.log.error(`❌ Repository creation failed: ${error}`);
    throw error;
  }
}

/**
 * Check if repository exists
 */
export async function checkRepositoryExists(
  context: ProbotContext,
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    await context.octokit.repos.get({ owner, repo });
    return true;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Push files to repository
 */
export async function pushFilesToRepository(
  context: ProbotContext,
  owner: string,
  repo: string,
  files: FileContent[]
) {
  try {
    // Get default branch
    const repoInfo = await context.octokit.repos.get({ owner, repo });
    const defaultBranch = repoInfo.data.default_branch;

    for (const file of files) {
      await context.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message: file.message || `Add ${file.path}`,
        content: Buffer.from(file.content).toString("base64"),
        branch: defaultBranch,
      });
    }

    context.log.info(`✅ Pushed ${files.length} files to ${owner}/${repo}`);
  } catch (error) {
    context.log.error(`❌ File push failed: ${error}`);
    throw error;
  }
}

/**
 * Create issue
 */
export async function createIssue(
  context: ProbotContext,
  title: string,
  body: string,
  labels: string[] = []
): Promise<any> {
  const { owner, repo } = getRepoInfo(context);

  try {
    return await context.octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });
  } catch (error) {
    context.log.error(`Failed to create issue: ${error}`);
    throw error;
  }
}

/**
 * Create comment
 */
export async function createComment(
  context: ProbotContext,
  issueNumber: number,
  body: string
): Promise<any> {
  const { owner, repo } = getRepoInfo(context);

  try {
    return await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  } catch (error) {
    context.log.error(`Failed to create comment: ${error}`);
    throw error;
  }
}

/**
 * Get file content
 */
export async function getFileContent(
  context: ProbotContext,
  path: string,
  ref?: string
): Promise<string | null> {
  const { owner, repo } = getRepoInfo(context);

  try {
    const response = await context.octokit.repos.getContent({
      owner,
      repo,
      path,
      ...(ref && { ref }),
    });

    if (Array.isArray(response.data)) {
      throw new Error(`Path ${path} is a directory, not a file`);
    }

    if (response.data.type !== "file") {
      throw new Error(`Path ${path} is not a file`);
    }

    const fileData = response.data as { content: string };
    return Buffer.from(fileData.content, "base64").toString("utf-8");
  } catch (error) {
    context.log.error(`Failed to get file content for ${path}: ${error}`);
    return null;
  }
}

/**
 * Register to MCP Servers Hub by creating PR
 */
export async function registerToHub(
  context: ProbotContext,
  projectInfo: MCPProjectRegistration
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    context.log.info(
      `🌐 Attempting to register ${projectInfo.name} to MCP Servers Hub`
    );

    const hubOwner = "ACNet-AI";
    const hubRepo = "mcp-servers-hub";
    const registryPath = "registry.json";

    // 🔧 Get Hub repository dedicated Installation Token
    const hubToken = process.env.GITHUB_HUB_TOKEN;
    let hubOctokit: Octokit;

    if (hubToken) {
      // Use personal access token
      hubOctokit = new Octokit({ auth: hubToken });
      context.log.info("🔑 Using personal access token for Hub registration");
    } else {
      // Get Hub repository Installation Token
      try {
        const hubInstallationToken = await getHubInstallationToken();
        hubOctokit = new Octokit({ auth: hubInstallationToken });
        context.log.info("🏢 Using Hub repository Installation Token");
      } catch (error) {
        context.log.error(`❌ Failed to get Hub Installation Token: ${error}`);
        throw new Error(
          `Hub access failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Get current registry content
    const { data: file } = await hubOctokit.rest.repos.getContent({
      owner: hubOwner,
      repo: hubRepo,
      path: registryPath,
    });

    if (!("content" in file)) {
      throw new Error("Registry file not found or is a directory");
    }

    // Decode and parse registry
    const registryContent = Buffer.from(file.content, "base64").toString();
    const registry = JSON.parse(registryContent);

    if (!registry.projects) {
      registry.projects = [];
    }

    // Check if project already exists
    const existingIndex = registry.projects.findIndex(
      (p: MCPProjectRegistration) => p.repository === projectInfo.repository  // 🔧 Fix: Use repository URL for identification
    );

    if (existingIndex !== -1) {
      // Update existing project
      registry.projects[existingIndex] = projectInfo;
      context.log.info(`♻️ Updating existing project: ${projectInfo.name} (${projectInfo.repository})`);
    } else {
      // Add new project
      registry.projects.push(projectInfo);
      context.log.info(`➕ Adding new project: ${projectInfo.name} (${projectInfo.repository})`);
    }

    // Update file
    const updatedContent = JSON.stringify(registry, null, 2);

    await hubOctokit.rest.repos.createOrUpdateFileContents({
      owner: hubOwner,
      repo: hubRepo,
      path: registryPath,
      message: `${existingIndex !== -1 ? "Update" : "Add"} MCP project: ${projectInfo.name}`,
      content: Buffer.from(updatedContent).toString("base64"),
      sha: file.sha,
    });

    const registryUrl = `https://github.com/${hubOwner}/${hubRepo}/blob/main/${registryPath}`;

    context.log.info(
      `✅ Successfully registered ${projectInfo.name} to MCP Hub`
    );

    return {
      success: true,
      url: registryUrl,
    };
  } catch (error) {
    context.log.error(`❌ Failed to register to Hub: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Remove project from MCP Hub registry
 */
export async function removeFromHub(
  context: ProbotContext,
  repositoryUrl: string  // 🔧 Parameter change: Use complete repository URL
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    context.log.info(
      `🗑️ Attempting to remove project from MCP Servers Hub: ${repositoryUrl}`
    );

    const hubOwner = "ACNet-AI";
    const hubRepo = "mcp-servers-hub";
    const registryPath = "registry.json";

    // 🔧 Get Hub repository dedicated Installation Token
    const hubToken = process.env.GITHUB_HUB_TOKEN;
    let hubOctokit: Octokit;

    if (hubToken) {
      // Use personal access token
      hubOctokit = new Octokit({ auth: hubToken });
      context.log.info("🔑 Using personal access token for Hub removal");
    } else {
      // Get Hub repository Installation Token
      try {
        const hubInstallationToken = await getHubInstallationToken();
        hubOctokit = new Octokit({ auth: hubInstallationToken });
        context.log.info("🏢 Using Hub repository Installation Token");
      } catch (error) {
        context.log.error(`❌ Failed to get Hub Installation Token: ${error}`);
        throw new Error(
          `Hub access failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Get current registry content
    const { data: file } = await hubOctokit.rest.repos.getContent({
      owner: hubOwner,
      repo: hubRepo,
      path: registryPath,
    });

    if (!("content" in file)) {
      throw new Error("Registry file not found or is a directory");
    }

    // Decode and parse registry
    const registryContent = Buffer.from(file.content, "base64").toString();
    const registry = JSON.parse(registryContent);

    if (!registry.projects) {
      registry.projects = [];
    }

    // Check if project exists by repository URL
    const existingIndex = registry.projects.findIndex(
      (p: MCPProjectRegistration) => p.repository === repositoryUrl  // 🔧 Fix: Use repository URL for lookup
    );

    if (existingIndex === -1) {
      context.log.info(`📝 Project not found in registry: ${repositoryUrl}`);
      return {
        success: true,
        url: `https://github.com/${hubOwner}/${hubRepo}/blob/main/${registryPath}`,
      };
    }

    // Remove project from registry
    const removedProject = registry.projects[existingIndex];
    registry.projects.splice(existingIndex, 1);
    context.log.info(`🗑️ Removing project: ${removedProject.name} (${repositoryUrl})`);

    // Update file
    const updatedContent = JSON.stringify(registry, null, 2);

    await hubOctokit.rest.repos.createOrUpdateFileContents({
      owner: hubOwner,
      repo: hubRepo,
      path: registryPath,
      message: `Remove MCP project: ${removedProject.name}`,
      content: Buffer.from(updatedContent).toString("base64"),
      sha: file.sha,
    });

    const registryUrl = `https://github.com/${hubOwner}/${hubRepo}/blob/main/${registryPath}`;

    context.log.info(
      `✅ Successfully removed project from MCP Hub: ${repositoryUrl}`
    );

    return {
      success: true,
      url: registryUrl,
    };
  } catch (error) {
    context.log.error(`❌ Failed to remove from Hub: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Report error by creating an issue
 */
export async function reportError(
  context: ProbotContext,
  action: string,
  error: unknown,
  shouldCreateIssue = false
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const logMessage = `${action} failed: ${errorMessage}`;

  context.log.error(logMessage);

  if (shouldCreateIssue) {
    try {
      await createIssue(
        context,
        `🚨 Automation Error: ${action}`,
        `An error occurred during ${action}:\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\nPlease check the logs for more details.`,
        ["bug", "automation"]
      );
    } catch (issueError) {
      context.log.error(`Failed to create error report issue: ${issueError}`);
    }
  }
}

/**
 * Common labels used throughout the app
 */
export const LABELS = {
  MCP_SERVER: "mcp-server",
  VALIDATION_PASSED: "validation-passed",
  VALIDATION_FAILED: "validation-failed",
  AUTO_MERGED: "auto-merged",
  NEEDS_REVIEW: "needs-review",
  BUG: "bug",
  AUTOMATION: "automation",
  AUTO_REGISTERED: "auto-registered",
  REGISTRATION_READY: "registration-ready",
  REGISTRATION_PENDING: "registration-pending",
  MANUAL_REVIEW: "manual-review",
  WELCOME: "welcome",
} as const;
