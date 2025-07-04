import { ProbotContext } from "../types";
import { AppError } from "../errors";

/**
 * Send success notification
 */
export async function notifySuccess(
  context: ProbotContext,
  message: string,
  details?: string
): Promise<void> {
  const emoji = getRandomEmoji("success");
  const fullMessage = `${emoji} **Success!** ${message}${details ? `\n\n${details}` : ""}`;

  await createComment(context, fullMessage);
}

/**
 * Send error notification
 */
export async function notifyError(
  context: ProbotContext,
  error: AppError,
  action?: string
): Promise<void> {
  const emoji = getRandomEmoji("error");
  const actionText = action ? ` during ${action}` : "";

  let message = `${emoji} **Error${actionText}**\n\n`;
  message += `**Error message:** ${error.message}\n`;

  if (error.context?.["suggestions"]) {
    message += `\n**Suggestions:**\n${error.context["suggestions"]}`;
  }

  await createComment(context, message);
}

/**
 * Send warning notification
 */
export async function notifyWarning(
  context: ProbotContext,
  message: string,
  suggestions?: string[]
): Promise<void> {
  const emoji = getRandomEmoji("warning");
  let fullMessage = `${emoji} **Warning!** ${message}`;

  if (suggestions && suggestions.length > 0) {
    fullMessage += "\n\n**Suggestions:**\n" + suggestions.map(s => `- ${s}`).join("\n");
  }

  await createComment(context, fullMessage);
}

/**
 * Send validation error notification
 */
export async function notifyValidationErrors(
  context: ProbotContext,
  errors: string[]
): Promise<void> {
  const emoji = getRandomEmoji("error");
  let message = `${emoji} **Project validation failed**\n\n`;
  message += "The following issues were found:\n";
  message += errors.map(error => `- ${error}`).join("\n");
  message += "\n\nPlease fix these issues and resubmit.";

  await createComment(context, message);
}

/**
 * Send release notification
 */
export async function notifyRelease(
  context: ProbotContext,
  version: string,
  repoUrl: string
): Promise<void> {
  const emoji = getRandomEmoji("success");
  const message =
    `${emoji} **New version released successfully!**\n\n` +
    `**Version:** ${version}\n` +
    `**Repository:** ${repoUrl}\n\n` +
    `Congratulations! Your project has been successfully published to the MCP ecosystem.`;

  await createComment(context, message);
}

// Helper function: create comment
async function createComment(context: ProbotContext, body: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = context.payload as any;

  try {
    if (payload.pull_request) {
      // PR comment
      await context.octokit.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.pull_request.number,
        body,
      });
    } else if (payload.issue) {
      // Issue comment
      await context.octokit.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        body,
      });
    } else {
      // Create new Issue
      await context.octokit.issues.create({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        title: "🤖 MCP Project Manager Notification",
        body,
      });
    }
  } catch (error) {
    context.log.error("Failed to send notification:", error);
  }
}

// Helper function: get random emoji
function getRandomEmoji(type: "success" | "error" | "warning"): string {
  const emojis = {
    success: ["🎉", "✅", "🚀", "🌟", "💯", "🎊"],
    error: ["❌", "🚨", "💥", "⚠️", "🔥"],
    warning: ["⚠️", "🟡", "📢", "💡", "🔔"],
  };

  const list = emojis[type];
  return list[Math.floor(Math.random() * list.length)] || "🔧";
}
