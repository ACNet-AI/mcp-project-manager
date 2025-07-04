import { Probot } from "probot";
import { WebhookHandler } from "./webhook-handler";
import { ApiServer } from "./api-server";
import { ErrorHandler } from "./errors";
import { notifyError } from "./utils/notification";

/**
 * MCP Project Manager - GitHub App
 * Function: Automate the creation, publishing, and registration management of MCP server projects
 */
export = (app: Probot) => {
  app.log.info("🚀 MCP Project Manager started");

  // Create Webhook handler instance
  const webhookHandler = new WebhookHandler();

  // ===== Global error handling =====
  app.onError(async error => {
    const appError = ErrorHandler.normalize(error, "Global error");
    app.log.error(`🚨 Global error: ${appError}`);
  });

  // ===== Webhook event handling =====

  // 🆕 Installation event - triggered when user installs App
  app.on(["installation.created", "installation.deleted"], async context => {
    try {
      await webhookHandler.handleInstallation(context);
    } catch (error) {
      const appError = ErrorHandler.normalize(error, "Installation event handling");
      context.log.error("Installation event error:", appError);
      await notifyError(context, appError, "installation event processing");
    }
  });

  // Push event
  app.on("push", async context => {
    try {
      await webhookHandler.handlePush(context);
    } catch (error) {
      const appError = ErrorHandler.normalize(error, "Push event handling");
      context.log.error("Push event error:", appError);
      await notifyError(context, appError, "push event processing");
    }
  });

  // Pull Request event
  app.on(
    ["pull_request.opened", "pull_request.synchronize", "pull_request.closed"],
    async context => {
      try {
        await webhookHandler.handlePullRequest(context);
      } catch (error) {
        const appError = ErrorHandler.normalize(error, "Pull request event handling");
        context.log.error("Pull request event error:", appError);
        await notifyError(context, appError, "pull request event processing");
      }
    }
  );

  // Release event
  app.on("release.published", async context => {
    try {
      await webhookHandler.handleRelease(context);
    } catch (error) {
      const appError = ErrorHandler.normalize(error, "Release event handling");
      context.log.error("Release event error:", appError);
      await notifyError(context, appError, "release event processing");
    }
  });

  // Issues event
  app.on(["issues.opened", "issues.labeled"], async context => {
    try {
      await webhookHandler.handleIssues(context);
    } catch (error) {
      const appError = ErrorHandler.normalize(error, "Issues event handling");
      context.log.error("Issues event error:", appError);
      await notifyError(context, appError, "issues event processing");
    }
  });

  // Repository event
  app.on("repository.created", async context => {
    try {
      await webhookHandler.handleRepository(context);
    } catch (error) {
      const appError = ErrorHandler.normalize(error, "Repository event handling");
      context.log.error("Repository event error:", appError);
      await notifyError(context, appError, "repository event processing");
    }
  });

  // ===== API server setup =====
  const apiServer = new ApiServer();
  apiServer.setProbotInstance(app);

  app.log.info("✅ MCP Project Manager initialized");
};
