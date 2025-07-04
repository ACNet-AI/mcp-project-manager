import {
  ProbotContext,
  PackageJsonType,
  MCPDetectionResult,
  ValidationResult,
  RepoInfo,
  FileContent,
  WebhookPayload,
} from "../types";

/**
 * GitHub API common utility functions
 * Supports Account-level and Repository-level operations
 */

// Unified repository information extraction
export function getRepoInfo(context: ProbotContext): RepoInfo {
  const payload = context.payload as unknown as WebhookPayload;
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

// 🆕 Create user repository (Account permissions)
export async function createUserRepository(
  context: ProbotContext,
  repoName: string,
  options: {
    description?: string;
    private?: boolean;
    autoInit?: boolean;
    gitignoreTemplate?: string;
    licenseTemplate?: string;
  } = {}
) {
  try {
    const response = await context.octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: options.description || `MCP server project: ${repoName}`,
      private: options.private || false,
      auto_init: options.autoInit || true,
      gitignore_template: options.gitignoreTemplate || "Python",
      license_template: options.licenseTemplate || "mit",
    });

    context.log.info(`✅ Repository created successfully: ${response.data.full_name}`);
    return response.data;
  } catch (error) {
    context.log.error(`❌ Repository creation failed: ${error}`);
    throw error;
  }
}

// 🆕 Check if repository exists
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

// 🆕 Push files to repository
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

// 🆕 MCP project detection
export function detectMCPProject(
  packageJson: PackageJsonType | null,
  projectFiles: string[]
): MCPDetectionResult {
  const reasons: string[] = [];
  let score = 0;

  // Check package.json/pyproject.toml
  if (packageJson) {
    if (packageJson.name?.includes("mcp")) {
      score += 30;
      reasons.push('Project name contains "mcp"');
    }

    if (packageJson.description?.toLowerCase().includes("mcp")) {
      score += 20;
      reasons.push("Description contains MCP-related content");
    }

    if (packageJson.keywords?.some((k: string) => k.includes("mcp"))) {
      score += 25;
      reasons.push("Keywords contain MCP");
    }
  }

  // Check file structure
  if (projectFiles.includes("server.py") || projectFiles.includes("index.js")) {
    score += 15;
    reasons.push("Contains server files");
  }

  if (projectFiles.some(f => f.includes("mcp"))) {
    score += 10;
    reasons.push("Filename contains MCP");
  }

  return {
    isMCPProject: score >= 50,
    confidence: Math.min(score, 100),
    reasons,
  };
}

// 🆕 Auto register to mcp-servers-hub
export async function registerToHub(
  context: ProbotContext,
  projectInfo: {
    name: string;
    owner: string;
    repo: string;
    description: string;
    version: string;
    language: string;
    category?: string;
    tags?: string[];
  }
) {
  try {
    const hubOwner = "ACNet-AI";
    const hubRepo = "mcp-servers-hub";

    // 1. Get current registry
    const registryFile = await context.octokit.repos.getContent({
      owner: hubOwner,
      repo: hubRepo,
      path: "registry.json",
    });

    if (Array.isArray(registryFile.data)) {
      throw new Error("registry.json is a directory");
    }

    const registryContent = Buffer.from(
      (registryFile.data as { content: string }).content,
      "base64"
    ).toString("utf-8");

    const registry = JSON.parse(registryContent);

    // 2. Add new project
    const newProject = {
      name: projectInfo.name,
      repository: `https://github.com/${projectInfo.owner}/${projectInfo.repo}`,
      author: projectInfo.owner,
      description: projectInfo.description,
      version: projectInfo.version,
      language: projectInfo.language,
      category: projectInfo.category || "utilities",
      tags: projectInfo.tags || [],
      homepage: `https://github.com/${projectInfo.owner}/${projectInfo.repo}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Check if already exists
    const existingIndex = registry.projects.findIndex(
      (p: { repository: string }) => p.repository === newProject.repository
    );

    if (existingIndex >= 0) {
      // Update existing project
      registry.projects[existingIndex] = {
        ...registry.projects[existingIndex],
        ...newProject,
      };
    } else {
      // Add new project
      registry.projects.push(newProject);
    }

    // Update statistics
    registry.total_projects = registry.projects.length;
    registry.updated = new Date().toISOString();

    // 3. Create PR to update registry
    const branchName = `auto-register-${projectInfo.name}-${Date.now()}`;

    // Create new branch
    const mainBranch = await context.octokit.repos.getBranch({
      owner: hubOwner,
      repo: hubRepo,
      branch: "main",
    });

    await context.octokit.git.createRef({
      owner: hubOwner,
      repo: hubRepo,
      ref: `refs/heads/${branchName}`,
      sha: mainBranch.data.commit.sha,
    });

    // Update registry.json
    await context.octokit.repos.createOrUpdateFileContents({
      owner: hubOwner,
      repo: hubRepo,
      path: "registry.json",
      message: `🤖 Auto register project: ${projectInfo.name}`,
      content: Buffer.from(JSON.stringify(registry, null, 2)).toString("base64"),
      branch: branchName,
      sha: (registryFile.data as { sha: string }).sha,
    });

    // Create PR
    const pr = await context.octokit.pulls.create({
      owner: hubOwner,
      repo: hubRepo,
      title: `🚀 Add MCP project: ${projectInfo.name}`,
      head: branchName,
      base: "main",
      body: `## 🤖 Auto register new MCP project

**Project Information:**
- 📦 **Name**: ${projectInfo.name}
- 👤 **Author**: ${projectInfo.owner}  
- 🔗 **Repository**: https://github.com/${projectInfo.owner}/${projectInfo.repo}
- 📝 **Description**: ${projectInfo.description}
- 🏷️ **Version**: ${projectInfo.version}
- 💻 **Language**: ${projectInfo.language}

**Auto validation results:**
- ✅ Project structure validation passed
- ✅ MCP protocol compatibility confirmed
- ✅ Basic quality checks passed

_This PR was automatically created by MCP Project Manager_`,
    });

    // Auto merge PR (if validation passed)
    await context.octokit.pulls.merge({
      owner: hubOwner,
      repo: hubRepo,
      pull_number: pr.data.number,
      commit_title: `🤖 Auto register: ${projectInfo.name}`,
      merge_method: "squash",
    });

    context.log.info(`✅ Project registration successful: ${projectInfo.name}`);
    return pr.data;
  } catch (error) {
    context.log.error(`❌ Project registration failed: ${error}`);
    throw error;
  }
}

// Unified issue creation
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

// Unified comment creation
export async function createComment(context: ProbotContext, issueNumber: number, body: string) {
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

// Unified file retrieval
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

// Unified error handling and issue reporting
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

// MCP project validation (enhanced version)
export function validateMCPProject(packageJson: PackageJsonType): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic checks
  if (!packageJson.name) errors.push("Missing package name");
  if (!packageJson.description) warnings.push("Missing package description");
  if (!packageJson.main && !packageJson.module) errors.push("Missing entry point");

  // MCP-specific checks
  if (!packageJson.name?.includes("mcp")) {
    warnings.push('Package name should include "mcp" for better discoverability');
  }

  // Version checks
  if (!packageJson.version) {
    errors.push("Missing version field");
  }

  // Dependency checks
  if (packageJson.dependencies && !packageJson.dependencies["@modelcontextprotocol/sdk"]) {
    warnings.push("Missing MCP SDK dependency - consider adding @modelcontextprotocol/sdk");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Tag management
export const LABELS = {
  MCP_SERVER: "mcp-server",
  VALIDATION_PASSED: "validation-passed",
  VALIDATION_FAILED: "validation-failed",
  AUTO_MERGED: "auto-merged",
  NEEDS_REVIEW: "needs-review",
  BUG: "bug",
  AUTOMATION: "automation",
  AUTO_REGISTERED: "auto-registered",
} as const;
