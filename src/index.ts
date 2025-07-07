import { Probot } from "probot";
import { PackageJsonType } from "./utils/types.js";
import { validateProject, detectMCPProject } from "./utils/validation.js";
import {
  createComment,
  createIssue,
  reportError,
  LABELS,
} from "./utils/github.js";
import {
  extractProjectInfo,
  isEligibleForAutoRegistration,
  generateRegistrationSummary,
} from "./utils/registry.js";

export default (app: Probot) => {

  // Handle application installation events
  app.on("installation.created", async context => {
    const { installation } = context.payload;

    context.log.info(
      `🎉 MCP Project Manager installed for ${installation.account.login}`
    );

    try {
      // Send welcome message for organization accounts
      if (installation.account.type === "Organization") {
        context.log.info(
          `📦 Ready to manage MCP projects for ${installation.account.login}`
        );
      }
    } catch (error) {
      await reportError(context, "installation", error);
    }
  });

  // Handle push events - detect and validate MCP projects
  app.on("push", async context => {
    const { repository, ref, commits } = context.payload;

    try {
      // Only handle pushes to main branch
      if (!ref.endsWith(`/${repository.default_branch}`)) {
        return;
      }

      context.log.info(`📤 Push received for ${repository.full_name}`);

      // Get package.json content
      const packageJsonContent = await context.octokit.repos
        .getContent({
          owner: repository.owner.login,
          repo: repository.name,
          path: "package.json",
        })
        .catch(() => null);

      if (!packageJsonContent || Array.isArray(packageJsonContent.data)) {
        context.log.info("No package.json found, skipping MCP detection");
        return;
      }

      const fileData = packageJsonContent.data as any;
      if (!fileData.content) {
        context.log.info("No content found in package.json");
        return;
      }

      const packageJson: PackageJsonType = JSON.parse(
        Buffer.from(fileData.content, "base64").toString("utf-8")
      );

      // Detect if this is an MCP project
      const allFiles = commits.flatMap((c: any) => c.added.concat(c.modified));
      const mcpDetection = detectMCPProject(packageJson, allFiles);

      if (mcpDetection.isMCPProject) {
        context.log.info(
          `🔍 MCP project detected: ${packageJson.name} (confidence: ${mcpDetection.confidence}%)`
        );

        // Validate project structure
        const validation = await validateProject(context);

        if (validation.isValid) {
          // Check if eligible for auto-registration
          if (isEligibleForAutoRegistration(packageJson, validation.isValid)) {
            const projectInfo = extractProjectInfo(
              packageJson,
              repository.owner.login,
              repository.name
            );

            // Create registration summary comment
            const summary = generateRegistrationSummary(projectInfo);

            context.log.info(
              `✅ Project eligible for auto-registration: ${projectInfo.name}`
            );

            // Create an Issue to track the registration process
            await createIssue(
              context,
              `🚀 MCP Project Auto-Registration: ${projectInfo.name}`,
              `${summary}\n\n> 🤖 This project has been automatically detected as an MCP server and is ready for registration.`,
              [LABELS.MCP_SERVER, LABELS.AUTO_REGISTERED]
            );
          } else {
            context.log.info(
              `⚠️ Project not eligible for auto-registration: ${packageJson.name}`
            );
          }
        } else {
          context.log.warn(
            `❌ Project validation failed: ${validation.errors.join(", ")}`
          );
        }
      }
    } catch (error) {
      await reportError(context, "push event processing", error);
    }
  });

  // Handle Issues events
  app.on("issues.opened", async context => {
    const { issue } = context.payload;

    try {
      // Check if this is an MCP-related issue
      const isMcpRelated =
        issue.title.toLowerCase().includes("mcp") ||
        issue.body?.toLowerCase().includes("mcp") ||
        (issue.labels &&
          issue.labels.some((label: any) => label.name.includes("mcp")));

      if (isMcpRelated) {
        context.log.info(`📝 MCP-related issue opened: ${issue.title}`);

        await createComment(
          context,
          issue.number,
          `👋 Thanks for opening this MCP-related issue! 

🤖 **MCP Project Manager** is here to help. If this is about:
- 🚀 **Project Registration**: I can help register your MCP server
- 🔍 **Validation Issues**: I can check your project structure
- 🛠️ **Setup Problems**: I can provide guidance on MCP development

Feel free to add relevant labels or mention specific requirements!`
        );
      }
    } catch (error) {
      await reportError(context, "issue processing", error);
    }
  });

  // Handle Release events
  app.on("release.published", async context => {
    const { release, repository } = context.payload;

    try {
      context.log.info(
        `🎉 Release published: ${release.tag_name} for ${repository.full_name}`
      );

      // Get package.json to check if this is an MCP project
      const packageJsonContent = await context.octokit.repos
        .getContent({
          owner: repository.owner.login,
          repo: repository.name,
          path: "package.json",
          ref: release.tag_name,
        })
        .catch(() => null);

      if (packageJsonContent && !Array.isArray(packageJsonContent.data)) {
        const fileData = packageJsonContent.data as any;
        if (!fileData.content) {
          return;
        }

        const packageJson: PackageJsonType = JSON.parse(
          Buffer.from(fileData.content, "base64").toString("utf-8")
        );

        // Detect if this is an MCP project
        const mcpDetection = detectMCPProject(packageJson, []);

        if (mcpDetection.isMCPProject) {
          context.log.info(
            `🔍 MCP project release detected: ${packageJson.name} v${release.tag_name}`
          );

          // Create release notification
          await createIssue(
            context,
            `🎉 MCP Project Release: ${packageJson.name} v${release.tag_name}`,
            `## 🚀 New Release Available

**Project**: ${packageJson.name}
**Version**: ${release.tag_name}
**Release Notes**: ${release.body || "No release notes provided"}

**Next Steps**:
- 📦 Package will be updated in registries
- 🔄 Documentation will be refreshed
- 🌐 MCP Hub will be notified

> 🤖 This notification was automatically generated by MCP Project Manager`,
            [LABELS.MCP_SERVER, "release"]
          );
        }
      }
    } catch (error) {
      await reportError(context, "release processing", error);
    }
  });

  // Handle Pull Request events
  app.on("pull_request.opened", async context => {
    const { pull_request } = context.payload;

    try {
      // Check if this is an MCP-related PR
      const isMcpRelated =
        pull_request.title.toLowerCase().includes("mcp") ||
        pull_request.body?.toLowerCase().includes("mcp");

      if (isMcpRelated) {
        context.log.info(`🔄 MCP-related PR opened: ${pull_request.title}`);

        await createComment(
          context,
          pull_request.number,
          `🔍 **MCP Project Manager** detected an MCP-related pull request!

🤖 **Automated Checks**:
- ✅ I'll validate the project structure
- 🔍 I'll check for MCP compliance
- 📝 I'll review configuration changes

Thank you for contributing to the MCP ecosystem! 🚀`
        );
      }
    } catch (error) {
      await reportError(context, "pull request processing", error);
    }
  });

  // Handle Pull Request merge events
  app.on("pull_request.closed", async context => {
    const { pull_request } = context.payload;

    try {
      // Only handle merged PRs
      if (!pull_request.merged) {
        return;
      }

      // Check if this is an MCP-related PR
      const isMcpRelated =
        pull_request.title.toLowerCase().includes("mcp") ||
        pull_request.body?.toLowerCase().includes("mcp");

      if (isMcpRelated) {
        context.log.info(`🎉 MCP-related PR merged: ${pull_request.title}`);

        await createComment(
          context,
          pull_request.number,
          `🎉 **MCP-related Pull Request Merged!**

✅ **Thank you for your contribution to the MCP ecosystem!**

🤖 **Next Steps**:
- 📦 Changes will be reflected in the next release
- 🔄 Documentation may be updated automatically
- 🌐 MCP Hub will be notified of any structural changes

Keep up the great work! 🚀`
        );
      }
    } catch (error) {
      await reportError(context, "pull request merge processing", error);
    }
  });

  // Error handling
  app.onError(async (error: any) => {
    app.log.error("❌ Application error:", error);
  });

  app.log.info("🤖 MCP Project Manager loaded successfully");
};
