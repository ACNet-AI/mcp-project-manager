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
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) {
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

    // Get current registry.json content
    let currentRegistry: any[] = [];
    try {
      const { data: fileData } = await context.octokit.rest.repos.getContent({
        owner: hubOwner,
        repo: hubRepo,
        path: registryPath,
      });

      if ("content" in fileData) {
        const content = Buffer.from(fileData.content, "base64").toString(
          "utf-8"
        );
        currentRegistry = JSON.parse(content);
      }
    } catch (error) {
      context.log.warn(`Could not fetch current registry: ${error}`);
      // Continue with empty registry if file doesn't exist
    }

    // Check if project already exists
    const existingIndex = currentRegistry.findIndex(
      (item: any) => item.name === projectInfo.name
    );

    // Prepare new registry entry
    const registryEntry = {
      name: projectInfo.name,
      description: projectInfo.description,
      version: projectInfo.version,
      language: projectInfo.language,
      category: projectInfo.category,
      repository: projectInfo.repository,
      tags: projectInfo.tags || [],
      addedAt: new Date().toISOString(),
      ...(projectInfo.factoryVersion && {
        factoryVersion: projectInfo.factoryVersion,
      }),
    };

    let action = "add";
    if (existingIndex >= 0) {
      // Update existing entry
      currentRegistry[existingIndex] = {
        ...currentRegistry[existingIndex],
        ...registryEntry,
        updatedAt: new Date().toISOString(),
      };
      action = "update";
    } else {
      // Add new entry
      currentRegistry.push(registryEntry);
    }

    // Sort registry by name for consistency
    currentRegistry.sort((a, b) => a.name.localeCompare(b.name));

    const newContent = JSON.stringify(currentRegistry, null, 2);
    const branchName = `register-${projectInfo.name}-${Date.now()}`;

    try {
      // Get main branch SHA
      const { data: mainBranch } = await context.octokit.rest.repos.getBranch({
        owner: hubOwner,
        repo: hubRepo,
        branch: "main",
      });

      // Create new branch
      await context.octokit.rest.git.createRef({
        owner: hubOwner,
        repo: hubRepo,
        ref: `refs/heads/${branchName}`,
        sha: mainBranch.commit.sha,
      });

      // Update registry.json on new branch
      const { data: currentFile } = await context.octokit.rest.repos.getContent(
        {
          owner: hubOwner,
          repo: hubRepo,
          path: registryPath,
          ref: branchName,
        }
      );

      let fileSha = "";
      if ("sha" in currentFile) {
        fileSha = currentFile.sha;
      }

      await context.octokit.rest.repos.createOrUpdateFileContents({
        owner: hubOwner,
        repo: hubRepo,
        path: registryPath,
        message: `${action === "add" ? "Add" : "Update"} ${projectInfo.name} to MCP registry

Project: ${projectInfo.name}
Description: ${projectInfo.description}
Language: ${projectInfo.language}
Category: ${projectInfo.category}
Repository: ${projectInfo.repository}

Auto-generated by MCP Project Manager`,
        content: Buffer.from(newContent).toString("base64"),
        sha: fileSha,
        branch: branchName,
      });

      // Create pull request
      const { data: pullRequest } = await context.octokit.rest.pulls.create({
        owner: hubOwner,
        repo: hubRepo,
        title: `${action === "add" ? "🚀 Register" : "📝 Update"} ${projectInfo.name} in MCP Registry`,
        head: branchName,
        base: "main",
        body: `## ${action === "add" ? "New Project Registration" : "Project Update"}

**Project Name**: ${projectInfo.name}
**Description**: ${projectInfo.description}
**Version**: ${projectInfo.version}
**Language**: ${projectInfo.language}
**Category**: ${projectInfo.category}
**Repository**: ${projectInfo.repository}
**Tags**: ${(projectInfo.tags || []).join(", ")}
${projectInfo.factoryVersion ? `**Factory Version**: ${projectInfo.factoryVersion}` : ""}

### 📋 Project Details
This ${action === "add" ? "new MCP project has been automatically detected and validated" : "MCP project has been updated"} by the MCP Project Manager.

### ✅ Validation Status
- ✅ Project structure validated
- ✅ MCP dependencies confirmed
- ✅ Metadata extracted and verified
- ✅ Registry format validated

### 🔍 Review Checklist
- [ ] Project name is unique and descriptive
- [ ] Description accurately describes functionality
- [ ] Repository is accessible and contains valid MCP code
- [ ] Category and tags are appropriate
- [ ] Documentation quality is adequate

---
*This PR was automatically created by [MCP Project Manager](https://github.com/ACNet-AI/mcp-project-manager)*`,
      });

      context.log.info(
        `✅ Created registration PR #${pullRequest.number} for ${projectInfo.name}`
      );

      return {
        success: true,
        url: pullRequest.html_url,
      };
    } catch (prError) {
      context.log.error(`❌ Failed to create registration PR: ${prError}`);
      return {
        success: false,
        error: `Failed to create registration PR: ${prError instanceof Error ? prError.message : String(prError)}`,
      };
    }
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
