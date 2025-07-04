import {
  ProbotContext,
  InstallationPayload,
  IssuesPayload,
  PullRequestPayload,
  PushPayload,
  ReleasePayload,
  RepositoryPayload,
  PackageJsonType,
} from "./types";
import {
  createUserRepository,
  pushFilesToRepository,
  checkRepositoryExists,
  registerToHub,
} from "./utils/github-utils";
import { validateProject, detectMCPProject } from "./utils/validation";
import {
  notifySuccess,
  notifyError,
  notifyValidationErrors,
  notifyRelease,
} from "./utils/notification";
import { ErrorHandler } from "./errors";

/**
 * Publish request interface
 */
export interface PublishRequest {
  projectName: string;
  description?: string;
  version?: string;
  language: string;
  category?: string;
  tags?: string[];
  files: Array<{ path: string; content: string }>;
  packageJson?: PackageJsonType;
  owner?: string;
  repoName?: string;
}

/**
 * Unified Webhook event handler
 */
export class WebhookHandler {
  constructor() {}

  /**
   * 🆕 Handle Installation event - user installs App
   */
  async handleInstallation(context: ProbotContext) {
    const payload = context.payload as unknown as InstallationPayload;
    const { action, installation } = payload;

    context.log.info(
      `⚙️ Installation event: ${action} - ${installation?.account?.login || "unknown"}`
    );

    try {
      if (action === "created") {
        await this.handleInstallationCreated(context);
      } else if (action === "deleted") {
        await this.handleInstallationDeleted(context);
      }
    } catch (error) {
      const appError = ErrorHandler.normalize(error, `Handle Installation event (${action})`);
      context.log.error("Installation event error:", appError);
      await notifyError(context, appError);
    }
  }

  /**
   * 🆕 Handle publish request - called by mcp-factory
   */
  async handlePublishRequest(
    context: ProbotContext,
    request: PublishRequest
  ): Promise<{
    success: boolean;
    repoUrl?: string;
    registrationUrl?: string;
    error?: string;
  }> {
    try {
      // 1. Validate request data
      const validation = this.validatePublishRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // 2. Determine target repository info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = context.payload as any;
      const installation = payload.installation;
      if (!installation) {
        throw new Error("No installation found");
      }

      const targetOwner = request.owner || installation.account.login;
      const targetRepo = request.repoName || request.projectName;

      context.log.info(`🚀 Start publishing project: ${targetOwner}/${targetRepo}`);

      // 3. Check if repository exists
      const repoExists = await checkRepositoryExists(context, targetOwner, targetRepo);

      let repoData;
      if (!repoExists) {
        // 4. Create new repository
        context.log.info(`📦 Creating new repository: ${targetRepo}`);
        repoData = await createUserRepository(context, targetRepo, {
          description: request.description || "",
          private: false,
          autoInit: true,
          gitignoreTemplate: this.getGitignoreTemplate(request.language),
          licenseTemplate: "mit",
        });
      } else {
        context.log.info(`📦 Using existing repository: ${targetOwner}/${targetRepo}`);
        const repoResponse = await context.octokit.repos.get({
          owner: targetOwner,
          repo: targetRepo,
        });
        repoData = repoResponse.data;
      }

      // 5. Project file detection and validation
      const projectFiles = request.files.map(f => f.path);
      const mcpDetection = detectMCPProject(request.packageJson || null, projectFiles);

      if (!mcpDetection.isMCP) {
        throw new Error("Project does not meet MCP server standards");
      }

      // 6. Push files to repository
      context.log.info(`📝 Pushing ${request.files.length} files to repository`);
      await pushFilesToRepository(context, targetOwner, targetRepo, request.files);

      // 7. Register to MCP Hub
      context.log.info(`🌐 Registering to MCP Hub`);
      const registrationResult = await registerToHub(context, {
        name: request.projectName,
        owner: targetOwner,
        repo: targetRepo,
        description: request.description || "",
        version: request.version || "1.0.0",
        language: request.language,
        category: request.category || "general",
        tags: request.tags || [],
      });

      context.log.info(`✅ Project published successfully: ${repoData.html_url}`);

      return {
        success: true,
        repoUrl: repoData.html_url,
        registrationUrl: registrationResult.url,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.log.error(`❌ Project publishing failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle Issues event
   */
  async handleIssues(context: ProbotContext) {
    const payload = context.payload as unknown as IssuesPayload;
    const { action, issue } = payload;

    context.log.info(`🐛 Issues event: ${action} - ${issue?.title || "unknown"}`);

    try {
      switch (action) {
        case "opened":
          await this.handleIssueOpened(context);
          break;
        case "labeled":
          await this.handleIssueLabeled(context);
          break;
        default:
          context.log.info(`ℹ️ Ignored Issues action: ${action}`);
      }
    } catch (error) {
      const appError = ErrorHandler.normalize(error, `Handle Issues event (${action})`);
      context.log.error("Issues event error:", appError);
      await notifyError(context, appError);
    }
  }

  /**
   * Handle Pull Request event
   */
  async handlePullRequest(context: ProbotContext) {
    const payload = context.payload as unknown as PullRequestPayload;
    const { action, pull_request: pr } = payload;

    context.log.info(
      `🔀 PR event: ${action} - ${pr?.title || "unknown"} (#${pr?.number || "unknown"})`
    );

    try {
      switch (action) {
        case "opened":
        case "synchronize":
          await this.handlePRValidation(context);
          break;
        case "closed":
          if (pr?.merged) {
            await this.handlePRMerged(context);
          }
          break;
        default:
          context.log.info(`ℹ️ Ignored PR action: ${action}`);
      }
    } catch (error) {
      const appError = ErrorHandler.normalize(error, `Handle PR event (${action})`);
      context.log.error("Pull request event error:", appError);
      await notifyError(context, appError);
    }
  }

  /**
   * Handle Push event
   */
  async handlePush(context: ProbotContext) {
    const payload = context.payload as unknown as PushPayload;
    const { ref, commits } = payload;

    context.log.info(`📤 Push event: ${ref} - ${commits?.length || 0} commits`);

    try {
      // Only handle push to main branch
      if (ref === "refs/heads/main" || ref === "refs/heads/master") {
        await this.handleMainBranchPush(context);
      }
    } catch (error) {
      const appError = ErrorHandler.normalize(error, "Push event handling");
      context.log.error("Push event error:", appError);
      await notifyError(context, appError);
    }
  }

  /**
   * Handle Release events
   */
  async handleRelease(context: ProbotContext) {
    const payload = context.payload as unknown as ReleasePayload;
    const { action, release } = payload;

    context.log.info(`🚀 Release event: ${action} - ${release?.tag_name || "unknown"}`);

    try {
      if (action === "published") {
        await this.handleReleasePublished(context);
      }
    } catch (error) {
      const appError = ErrorHandler.normalize(error, `Handle Release event (${action})`);
      context.log.error("Release event error:", appError);
      await notifyError(context, appError);
    }
  }

  /**
   * Handle Repository events
   */
  async handleRepository(context: ProbotContext) {
    const payload = context.payload as unknown as RepositoryPayload;
    const { action } = payload;

    context.log.info(`📁 Repository event: ${action}`);

    try {
      if (action === "created") {
        await this.handleRepositoryCreated(context);
      }
    } catch (error) {
      const appError = ErrorHandler.normalize(error, `Handle Repository event (${action})`);
      context.log.error("Repository event error:", appError);
      await notifyError(context, appError);
    }
  }

  // ===== Private methods =====

  private async handleInstallationCreated(context: ProbotContext) {
    const payload = context.payload as unknown as InstallationPayload;
    const accountName = payload.installation?.account?.login || "unknown";

    await notifySuccess(
      context,
      `Welcome to MCP Project Manager!`,
      `Thank you @${accountName} for installing our app. Now you can:\n\n` +
        `• Automatically create and manage MCP server projects\n` +
        `• Publish to GitHub repository with one click\n` +
        `• Automatically register to MCP server center\n\n` +
        `Start using by checking our documentation: https://github.com/mcp-servers-hub/mcp-project-manager`
    );
  }

  private async handleInstallationDeleted(context: ProbotContext) {
    const payload = context.payload as unknown as InstallationPayload;
    const accountName = payload.installation?.account?.login || "unknown";

    context.log.info(`👋 User ${accountName} uninstalled the app`);
    // Here you can add cleanup logic, like deleting related data
  }

  private async handleIssueOpened(context: ProbotContext) {
    const payload = context.payload as unknown as IssuesPayload;
    const issue = payload.issue;

    if (!issue) return;

    // Check if it's an MCP-related issue
    const title = issue.title.toLowerCase();
    const body = issue.body?.toLowerCase() || "";

    if (
      title.includes("mcp") ||
      body.includes("mcp") ||
      title.includes("model context protocol") ||
      body.includes("model context protocol")
    ) {
      await notifySuccess(
        context,
        "Thank you for submitting an MCP-related Issue!",
        "We will handle your issue as soon as possible. If you need help publishing an MCP server, please check our documentation."
      );
    }
  }

  private async handleIssueLabeled(context: ProbotContext) {
    const payload = context.payload as unknown as IssuesPayload;
    const label = payload.label;

    if (label?.name === "mcp-server" || label?.name === "help wanted") {
      await notifySuccess(
        context,
        "Label added!",
        "We noticed that this Issue is marked as MCP-related. The team will prioritize it."
      );
    }
  }

  private async handlePRValidation(context: ProbotContext) {
    const payload = context.payload as unknown as PullRequestPayload;
    const pr = payload.pull_request;

    if (!pr) return;

    context.log.info(`🔍 Validating PR: ${pr.title} (#${pr.number})`);

    try {
      // Get PR modified files
      const files = await context.octokit.pulls.listFiles({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        pull_number: pr.number,
      });

      // Check if project files are included
      const projectFiles = files.data.filter(
        file => file.filename.startsWith("projects/") || file.filename.includes("package.json")
      );

      if (projectFiles.length > 0) {
        // Validate project structure
        const projectPaths = [
          ...new Set(
            projectFiles.map(f => f.filename.match(/^projects\/([^/]+)/)?.[1]).filter(Boolean)
          ),
        ];

        for (const projectName of projectPaths) {
          const validation = await validateProject(context, `projects/${projectName}`, pr.head.sha);

          if (!validation.isValid) {
            await notifyValidationErrors(context, validation.errors);
            return;
          }
        }

        await notifySuccess(
          context,
          "Project validation passed!",
          `Detected ${projectPaths.length} projects, all validations passed.`
        );
      }
    } catch (error) {
      const appError = ErrorHandler.normalize(error, "PR validation");
      await notifyError(context, appError);
    }
  }

  private async handlePRMerged(context: ProbotContext) {
    const payload = context.payload as unknown as PullRequestPayload;
    const pr = payload.pull_request;

    if (!pr) return;

    context.log.info(`✅ PR merged: ${pr.title} (#${pr.number})`);

    await notifySuccess(
      context,
      "Pull Request merged successfully!",
      "Thank you for your contribution! If this is a new MCP server project, it will appear in our directory soon."
    );
  }

  private async handleMainBranchPush(context: ProbotContext) {
    context.log.info(`📝 Main branch updated, checking for new projects...`);

    // Here you can add logic to detect new projects
    // and automatically trigger registration process
  }

  private async handleReleasePublished(context: ProbotContext) {
    const payload = context.payload as unknown as ReleasePayload;
    const release = payload.release;

    if (!release) return;

    context.log.info(`🎉 New version published: ${release.tag_name}`);

    await notifyRelease(context, release.tag_name, payload.repository.html_url);

    // Here you can add logic to automatically update Hub registration information
  }

  private async handleRepositoryCreated(context: ProbotContext) {
    const payload = context.payload as unknown as RepositoryPayload;
    const repo = payload.repository;

    context.log.info(`📁 New repository created: ${repo.full_name}`);

    // Check if it's an MCP-related repository
    const repoName = repo.name.toLowerCase();
    const description = repo.description?.toLowerCase() || "";

    if (
      repoName.includes("mcp") ||
      description.includes("mcp") ||
      description.includes("model context protocol")
    ) {
      await notifySuccess(
        context,
        "MCP-related repository detected!",
        "If you need help setting up and publishing an MCP server, please check our documentation or create an Issue."
      );
    }
  }

  /**
   * Validate publish request
   */
  private validatePublishRequest(request: PublishRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.projectName) {
      errors.push("Project name is required");
    }

    if (!request.language) {
      errors.push("Programming language is required");
    }

    if (!request.files || request.files.length === 0) {
      errors.push("At least one project file is required");
    }

    // Validate file path security
    if (request.files) {
      for (const file of request.files) {
        if (file.path.includes("..") || file.path.startsWith("/")) {
          errors.push(`Unsafe file path: ${file.path}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get .gitignore template
   */
  private getGitignoreTemplate(language: string): string {
    const templates: Record<string, string> = {
      javascript: "node",
      typescript: "node",
      python: "python",
      java: "java",
      csharp: "visualstudio",
      cpp: "c++",
      go: "go",
      rust: "rust",
    };

    return templates[language.toLowerCase()] || "node";
  }
}
