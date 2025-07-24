import { readFileSync } from "fs";
import { join } from "path";

/**
 * Simple template rendering utility
 * Supports {{VARIABLE}} format variable replacement
 */
export function renderTemplate(
  templatePath: string,
  variables: Record<string, string>
): string {
  try {
    // In Vercel environment, public files are accessible
    const template = readFileSync(
      join(process.cwd(), "public", templatePath),
      "utf-8"
    );

    // Replace template variables
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, "g"), value);
    }

    // Clean up unused template variables (set to empty string)
    rendered = rendered.replace(/\{\{[A-Z_]+\}\}/g, "");

    return rendered;
  } catch (error) {
    console.error(`Failed to render template ${templatePath}:`, error);
    // Return basic error page
    return `
      <!DOCTYPE html>
      <html>
      <head><title>Template Error</title></head>
      <body>
        <h1>Template Rendering Error</h1>
        <p>Failed to load template: ${templatePath}</p>
        <p>Error: ${error instanceof Error ? error.message : "Unknown error"}</p>
      </body>
      </html>
    `;
  }
}

/**
 * GitHub installation callback page template data generator
 */
export function createCallbackTemplateData(data: {
  installation_id: string;
  username: string;
  hasUserToken: boolean;
  installationTokenObtained: boolean;
  projectName?: string;
}): Record<string, string> {
  const {
    installation_id,
    username,
    hasUserToken,
    installationTokenObtained,
    projectName = "mcp-project",
  } = data;

  return {
    // Basic information
    INSTALLATION_ID: installation_id,
    USERNAME: username,
    PROJECT_NAME: projectName,
    TIMESTAMP: new Date().toLocaleString(),

    // Title related
    OAUTH_TITLE: hasUserToken ? " & OAuth Authorization" : "",
    STATUS_TITLE: installationTokenObtained ? " Successful" : " Partially Successful",
    STATUS: installationTokenObtained ? "Successful" : "Partially Successful",

    // Status styles
    STATUS_CLASS: installationTokenObtained ? "success" : "warning",

    // Installation Token status
    INSTALLATION_TOKEN_CLASS: installationTokenObtained ? "status-ok" : "status-error",
    INSTALLATION_TOKEN_STATUS: installationTokenObtained ? "✓" : "✗",
    INSTALLATION_TOKEN_MESSAGE: installationTokenObtained
      ? "Obtained"
      : "Failed to obtain",

    // User Token status
    USER_TOKEN_CLASS: hasUserToken ? "status-ok" : "status-error",
    USER_TOKEN_STATUS: hasUserToken ? "✓" : "✗",
    USER_TOKEN_MESSAGE: hasUserToken ? "Obtained" : "Not obtained",

    // Feature support status
    SUPPORTED_FEATURES:
      installationTokenObtained && hasUserToken
        ? "Personal repositories + Organization repositories"
        : installationTokenObtained
          ? "Organization repositories only"
          : "Limited functionality",

    // Conditional content blocks
    INSTALLATION_WARNING: !installationTokenObtained
      ? `
      <div class="warning">
        <h3>⚠️ Installation Token Retrieval Failed</h3>
        <p>GitHub App is installed, but unable to obtain Installation Token. Please check:</p>
        <ul>
          <li>APP_ID and PRIVATE_KEY environment variables are correctly configured</li>
          <li>GitHub App permissions are properly set</li>
          <li>Network connection is normal</li>
        </ul>
      </div>
      `
      : "",

    USER_TOKEN_INFO: !hasUserToken
      ? `
      <div class="info">
        <h3>💡 Enable Full Functionality</h3>
        <p>To create personal repositories, please enable in GitHub App settings:</p>
        <p><strong>"Request user authorization (OAuth) during installation"</strong></p>
      </div>
      `
      : "",

    // Repository type status
    PERSONAL_REPO_STATUS: hasUserToken
      ? "API automatically uses OAuth Token"
      : "Need to enable OAuth",
    ORG_REPO_STATUS: installationTokenObtained
      ? "API automatically uses Installation Token"
      : "Need to fix configuration",
    SMART_SELECTION_STATUS: installationTokenObtained
      ? "No need to worry about Token type, one ID handles everything!"
      : "Will be enabled after configuration is fixed",
  };
} 