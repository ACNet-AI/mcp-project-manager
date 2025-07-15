import { Probot } from "probot";
import {
  detectMCPFactoryProject,
  validateMCPFactoryProject,
  validateMCPFactoryProjectForRegistration,
} from "./utils/validation.js";
import {
  createComment,
  createIssue,
  reportError,
  registerToHub,
  LABELS,
} from "./utils/github.js";
import {
  extractProjectInfo,
  isEligibleForAutoRegistration,
  generateRegistrationSummary,
  validateMCPRelevance,
} from "./utils/registry.js";

export default (app: Probot) => {
  // Handle application installation events
  app.on("installation.created", async context => {
    const { installation } = context.payload;

    const account = installation.account;
    const accountLogin =
      account && "login" in account ? account.login : "unknown";
    const accountType = account && "type" in account ? account.type : undefined;

    context.log.info(`🎉 MCP Project Manager installed for ${accountLogin}`);

    try {
      if (accountType === "Organization") {
        context.log.info(
          `📦 Ready to manage MCP Factory projects for ${accountLogin}`
        );
      }
    } catch (error) {
      await reportError(context, "installation", error);
    }
  });

  // Handle push events - detect and validate MCP Factory projects
  app.on("push", async context => {
    const { repository, ref } = context.payload;

    try {
      // Only handle pushes to main branch
      if (!ref.endsWith(`/${repository.default_branch}`)) {
        return;
      }

      context.log.info(`📤 Push received for ${repository.full_name}`);

      // Check if repository owner exists
      if (!repository.owner) {
        context.log.error("Repository owner is null");
        return;
      }

      // Detect MCP Factory project
      const detectionResult = await detectMCPFactoryProject(
        context.octokit,
        repository.owner.login,
        repository.name,
        ref
      );

      if (!detectionResult.isMCPProject) {
        context.log.info(
          `❌ Not an MCP Factory project: ${detectionResult.reasons.join(", ")}`
        );
        return;
      }

      context.log.info(
        `✅ MCP Factory project detected with ${(detectionResult.confidence * 100).toFixed(1)}% confidence`
      );

      const project = detectionResult.projectData!;
      const validation = validateMCPFactoryProject(project);

      if (!validation.isValid) {
        context.log.warn(
          `⚠️ Project validation failed: ${validation.errors.join(", ")}`
        );

        // Create issue for validation errors
        const issueBody = `## Project Validation Issues

Your MCP Factory project has some structure issues that need attention:

### ❌ Errors:
${validation.errors.map(error => `- ${error}`).join("\n")}

${
  validation.warnings.length > 0
    ? `### ⚠️ Warnings:
${validation.warnings.map(warning => `- ${warning}`).join("\n")}`
    : ""
}

### 📋 Project Information:
- **Name**: ${project.name}
- **Version**: ${project.version}
- **Structure Compliance**: ${(project.structureCompliance * 100).toFixed(1)}%

### 🔧 How to Fix:
1. Ensure all required files are present: \`pyproject.toml\`, \`server.py\`, \`README.md\`
2. Create required directories: \`tools/\`, \`resources/\`, \`prompts/\`
3. Verify \`mcp-factory\` dependency in \`pyproject.toml\`
4. Complete project metadata (name, description, version)

Once these issues are resolved, push your changes to trigger automatic re-validation.

---
*This issue was automatically created by the MCP Project Manager.*`;

        await createIssue(
          context,
          "🔧 MCP Factory Project Structure Issues",
          issueBody,
          [LABELS.VALIDATION_FAILED]
        );

        return;
      }

      // Check eligibility for auto-registration
      if (isEligibleForAutoRegistration(project)) {
        context.log.info("🚀 Project eligible for auto-registration");

        const registrationValidation =
          validateMCPFactoryProjectForRegistration(project);

        if (registrationValidation.isValid) {
          const projectInfo = extractProjectInfo(
            project,
            repository.owner!.login,
            repository.name
          );

          const summary = generateRegistrationSummary(projectInfo);
          const relevance = validateMCPRelevance(project);

          // Actually perform the registration
          context.log.info("🚀 Starting automatic registration process...");
          const registrationResult = await registerToHub(context, projectInfo);

          let successBody = `## 🎉 Congratulations!

Your MCP Factory project meets all requirements for automatic registration.

### Project Summary:
${summary}

### ✅ Validation Results:
- **Structure Compliance**: ${(project.structureCompliance * 100).toFixed(1)}%
- **Factory Dependency**: ✅ Found
- **Required Files**: ✅ All present
- **Required Directories**: ✅ Complete
- **Metadata**: ✅ Valid

### 📋 Relevance Score:
- **Score**: ${relevance.score}/100
- **Relevant**: ${relevance.isRelevant ? "✅ Yes" : "❌ No"}
- **Reasons**: ${relevance.reasons.join(", ")}

### 🚀 Registration Status:`;

          if (registrationResult.success) {
            successBody += `
✅ **Registration PR Created Successfully!**

Your project has been automatically submitted to the MCP Servers Hub registry:
🔗 **Registration PR**: ${registrationResult.url}

The registration is now pending review by the MCP community. You will be notified once the PR is merged and your project is officially listed in the registry.

### Next Steps:
1. Monitor the registration PR for any feedback
2. Respond to any review comments if needed
3. Your project will be publicly available once the PR is approved`;
          } else {
            successBody += `
❌ **Automatic Registration Failed**

Unfortunately, the automatic registration encountered an error:
**Error**: ${registrationResult.error}

### Manual Registration Required:
Please submit your project manually to the MCP Servers Hub:
🔗 **Repository**: https://github.com/ACNet-AI/mcp-servers-hub
📝 **Instructions**: Follow the contribution guidelines in the repository

Your project meets all quality requirements and should be accepted for manual registration.`;
          }

          successBody += `

---
*This issue was automatically created by the MCP Project Manager.*`;

          await createIssue(
            context,
            registrationResult.success
              ? "🚀 MCP Factory Project Registration Submitted"
              : "⚠️ MCP Factory Project Registration Failed",
            successBody,
            registrationResult.success
              ? [LABELS.REGISTRATION_READY]
              : [LABELS.REGISTRATION_PENDING]
          );
        } else {
          const registrationIssueBody = `## Registration Requirements Not Met

Your MCP Factory project structure is valid, but there are some issues preventing automatic registration:

### ❌ Registration Errors:
${registrationValidation.errors.map(error => `- ${error}`).join("\n")}

${
  registrationValidation.warnings.length > 0
    ? `### ⚠️ Warnings:
${registrationValidation.warnings.map(warning => `- ${warning}`).join("\n")}`
    : ""
}

### 📋 Project Information:
- **Name**: ${project.name}
- **Version**: ${project.version}
- **Description**: ${project.description}
- **Structure Score**: ${(registrationValidation.score || 0).toFixed(1)}/100

### 🔧 Recommendations:
1. Ensure project description mentions MCP functionality
2. Add relevant keywords to pyproject.toml
3. Verify all metadata is complete and accurate

Once these issues are resolved, push your changes to trigger re-evaluation.

---
*This issue was automatically created by the MCP Project Manager.*`;

          await createIssue(
            context,
            "📝 MCP Factory Project Registration Issues",
            registrationIssueBody,
            [LABELS.REGISTRATION_PENDING]
          );
        }
      } else {
        context.log.info("❌ Project not eligible for auto-registration");

        const projectInfo = extractProjectInfo(
          project,
          repository.owner!.login,
          repository.name
        );

        const reasons = [
          `Structure compliance: ${(project.structureCompliance * 100).toFixed(1)}%`,
          `Has factory dependency: ${project.hasFactoryDependency ? "Yes" : "No"}`,
          `Required files: ${Object.values(project.requiredFiles).filter(Boolean).length}/${Object.keys(project.requiredFiles).length}`,
          `Required directories: ${Object.values(project.requiredDirectories).filter(Boolean).length}/${Object.keys(project.requiredDirectories).length}`,
        ];

        const manualReviewBody = `# 🔄 Manual Registration Request

## Project Information
${generateRegistrationSummary(projectInfo)}

## Registration Reasons
${reasons.map(reason => `- ${reason}`).join("\n")}

## Factory Project Details
- **Type**: MCP Factory Project
- **Language**: Python (required for factory projects)
- **Category**: ${projectInfo.category}
${projectInfo.factoryVersion ? `- **Factory Version**: ${projectInfo.factoryVersion}` : ""}

## Action Required
Please review this MCP Factory project for manual registration in the MCP Hub.

---
*This issue was automatically created by the MCP Project Manager.*`;

        await createIssue(
          context,
          `🔄 Manual Registration Request - ${project.name}`,
          manualReviewBody,
          [LABELS.MANUAL_REVIEW]
        );
      }
    } catch (error) {
      context.log.error("Error processing push event:", error);
      await reportError(context, "push", error);
    }
  });

  // Handle pull request events - validate changes to MCP Factory projects
  app.on("pull_request.opened", async context => {
    const { pull_request, repository } = context.payload;

    try {
      context.log.info(`🔀 PR opened for ${repository.full_name}`);

      const detectionResult = await detectMCPFactoryProject(
        context.octokit,
        repository.owner.login,
        repository.name,
        pull_request.head.sha
      );

      if (!detectionResult.isMCPProject) {
        context.log.info("❌ Not an MCP Factory project in PR");
        return;
      }

      context.log.info("✅ MCP Factory project detected in PR");

      const project = detectionResult.projectData!;
      const validation = validateMCPFactoryProject(project);

      const commentBody = `## 🧪 MCP Factory Project Validation Results

### Project Information:
- **Name**: ${project.name}
- **Version**: ${project.version}
- **Structure Compliance**: ${(project.structureCompliance * 100).toFixed(1)}%

### Validation Results:
${validation.isValid ? "✅ **Validation Passed**" : "❌ **Validation Failed**"}

${
  validation.errors.length > 0
    ? `### ❌ Errors:
${validation.errors.map(error => `- ${error}`).join("\n")}`
    : ""
}

${
  validation.warnings.length > 0
    ? `### ⚠️ Warnings:
${validation.warnings.map(warning => `- ${warning}`).join("\n")}`
    : ""
}

### 📊 Score: ${validation.score || 0}/100

${
  validation.isValid && isEligibleForAutoRegistration(project)
    ? "🚀 **This project is eligible for automatic registration when merged!**"
    : "📝 This project may require manual review for registration."
}

---
*Automated validation by MCP Project Manager*`;

      await createComment(context, pull_request.number, commentBody);
    } catch (error) {
      context.log.error("Error processing PR event:", error);
      await reportError(context, "pull_request", error);
    }
  });

  // Handle repository creation - check if it's a new MCP Factory project
  app.on("repository.created", async context => {
    const { repository } = context.payload;

    try {
      context.log.info(`📦 New repository created: ${repository.full_name}`);

      // Wait a bit for initial commit to be processed
      await new Promise(resolve => setTimeout(resolve, 5000));

      const detectionResult = await detectMCPFactoryProject(
        context.octokit,
        repository.owner.login,
        repository.name
      );

      if (detectionResult.isMCPProject) {
        context.log.info("🎉 New MCP Factory project detected!");

        const welcomeBody = `## Welcome to the MCP Project Manager!

We've detected that this is an MCP Factory project. The MCP Project Manager will help you:

- ✅ Validate your project structure
- 🚀 Automatically register eligible projects
- 📝 Provide guidance on MCP best practices

### 🔍 Initial Detection Results:
- **Confidence**: ${(detectionResult.confidence * 100).toFixed(1)}%
- **Reasons**: ${detectionResult.reasons.join(", ")}

Your project will be automatically validated with each push to the main branch. If your project meets all requirements, it will be eligible for automatic registration in the MCP Hub.

### 📚 Resources:
- [MCP Factory Documentation](https://github.com/your-org/mcp-factory)
- [Project Structure Guidelines](https://github.com/your-org/mcp-factory/docs/structure)

---
*This issue was automatically created by the MCP Project Manager.*`;

        await createIssue(
          context,
          "🎉 Welcome to MCP Factory Project Management!",
          welcomeBody,
          [LABELS.WELCOME]
        );
      }
    } catch (error) {
      context.log.error("Error processing repository creation:", error);
      await reportError(context, "repository", error);
    }
  });

  // Handle issues - respond to registration requests and questions
  app.on("issues.opened", async context => {
    const { issue, repository } = context.payload;

    try {
      const title = issue.title.toLowerCase();
      const body = issue.body?.toLowerCase() || "";

      if (title.includes("registration") || body.includes("register")) {
        const detectionResult = await detectMCPFactoryProject(
          context.octokit,
          repository.owner.login,
          repository.name
        );

        if (detectionResult.isMCPProject) {
          const project = detectionResult.projectData!;
          const validation = validateMCPFactoryProject(project);
          const relevance = validateMCPRelevance(project);

          const responseBody = `## 🔍 MCP Factory Project Status

Thank you for your registration inquiry! Here's the current status of your MCP Factory project:

### 📊 Project Analysis:
- **Detection Confidence**: ${(detectionResult.confidence * 100).toFixed(1)}%
- **Structure Compliance**: ${(project.structureCompliance * 100).toFixed(1)}%
- **Validation Score**: ${validation.score || 0}/100
- **Relevance Score**: ${relevance.score}/100

### ✅ Current Status:
${validation.isValid ? "✅ **Project structure is valid**" : "❌ **Project structure needs improvement**"}
${isEligibleForAutoRegistration(project) ? "🚀 **Eligible for automatic registration**" : "📝 **Requires manual review**"}

${
  validation.errors.length > 0
    ? `### ❌ Issues to resolve:
${validation.errors.map(error => `- ${error}`).join("\n")}`
    : ""
}

${
  validation.warnings.length > 0
    ? `### ⚠️ Recommendations:
${validation.warnings.map(warning => `- ${warning}`).join("\n")}`
    : ""
}

### 🚀 Next Steps:
${
  isEligibleForAutoRegistration(project)
    ? "Your project meets all requirements! It will be automatically registered on the next push to the main branch."
    : "Please address the issues above and push your changes. The project will be re-evaluated automatically."
}

---
*Automated response by MCP Project Manager*`;

          await createComment(context, issue.number, responseBody);
        } else {
          const notDetectedBody = `## ❌ MCP Factory Project Not Detected

This repository does not appear to be an MCP Factory project. The MCP Project Manager only handles projects created with the MCP Factory.

### 🔍 Detection Results:
- **Confidence**: ${(detectionResult.confidence * 100).toFixed(1)}%
- **Reasons**: ${detectionResult.reasons.join(", ")}

### 📚 To create an MCP Factory project:
1. Use the MCP Factory tool to generate a new project
2. Ensure your project has the required structure and dependencies
3. Push your project to this repository

---
*Automated response by MCP Project Manager*`;

          await createComment(context, issue.number, notDetectedBody);
        }
      }
    } catch (error) {
      context.log.error("Error processing issue:", error);
      await reportError(context, "issues", error);
    }
  });
};
