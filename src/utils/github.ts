import {
  ProbotContext,
  FileContent,
  RepositoryCreateOptions,
  MCPProjectRegistration,
} from "./types.js";

/**
 * GitHub API utility functions
 */

/**
 * Get repository information from context
 */
export function getRepoInfo(context: ProbotContext) {
  const payload = context.payload as any;
  const { repository } = payload;

  if (!repository) {
    throw new Error("Repository information is missing from payload");
  }

  return {
    owner: repository.owner.login,
    repo: repository.name,
    fullName: `${repository.owner.login}/${repository.name}`,
  };
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
  } catch (error: any) {
    if (error?.status === 404) {
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
) {
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
) {
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
 * Register to MCP Hub (simplified version)
 */
export async function registerToHub(
  context: ProbotContext,
  projectInfo: MCPProjectRegistration
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    context.log.info(
      `🌐 Attempting to register ${projectInfo.name} to MCP Hub`
    );

    // This is a simplified version - in real implementation,
    // you would integrate with actual MCP Hub API
    context.log.info(
      `✅ Project ${projectInfo.name} prepared for registration`
    );

    // For now, we just log the registration data
    // TODO: Implement actual MCP Hub API integration

    return {
      success: true,
      url: `https://mcphub.io/servers/${projectInfo.name}`,
    };
  } catch (error) {
    context.log.error(`❌ Project registration failed: ${error}`);
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
