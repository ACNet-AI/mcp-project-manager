import { MCPProjectRegistration, PackageJsonType } from "./types.js";

/**
 * MCP Hub Registry utilities
 */

/**
 * Extract project information from package.json for registry
 */
export function extractProjectInfo(
  packageJson: PackageJsonType,
  owner: string,
  repo: string
): MCPProjectRegistration {
  return {
    name: packageJson.name || repo,
    description: packageJson.description || "",
    repository: `https://github.com/${owner}/${repo}`,
    version: packageJson.version || "1.0.0",
    language: detectLanguageFromPackageJson(packageJson),
    category: extractCategoryFromKeywords(packageJson.keywords || []),
    tags: packageJson.keywords || [],
  };
}

/**
 * Detect programming language from package.json
 */
function detectLanguageFromPackageJson(packageJson: PackageJsonType): string {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  // Check for TypeScript
  if (deps["typescript"] || deps["@types/node"]) {
    return "typescript";
  }

  // Check for Python (if pyproject.toml exists, this would be Python)
  if (
    packageJson.name?.includes("python") ||
    Object.keys(deps).some(dep => dep.includes("python"))
  ) {
    return "python";
  }

  // Check for specific frameworks
  if (deps["react"] || deps["next"]) {
    return "typescript"; // Most React projects use TypeScript
  }

  // Default to JavaScript
  return "javascript";
}

/**
 * Extract category from keywords
 */
function extractCategoryFromKeywords(keywords: string[]): string {
  const categoryMap: Record<string, string> = {
    database: "database",
    api: "api",
    web: "web",
    cli: "tools",
    tool: "tools",
    utility: "utilities",
    server: "server",
    client: "client",
    integration: "integrations",
    ai: "ai",
    ml: "ai",
    "machine-learning": "ai",
  };

  for (const keyword of keywords) {
    const normalized = keyword.toLowerCase();
    if (categoryMap[normalized]) {
      return categoryMap[normalized];
    }
  }

  return "general";
}

/**
 * Validate registration data
 */
export function validateRegistrationData(projectInfo: MCPProjectRegistration): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!projectInfo.name || projectInfo.name.trim() === "") {
    errors.push("Project name is required");
  }

  if (!projectInfo.description || projectInfo.description.trim() === "") {
    errors.push("Project description is required");
  }

  if (!projectInfo.repository || !isValidGitHubUrl(projectInfo.repository)) {
    errors.push("Valid GitHub repository URL is required");
  }

  if (!projectInfo.version || !isValidVersion(projectInfo.version)) {
    errors.push("Valid semantic version is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if URL is a valid GitHub repository URL
 */
function isValidGitHubUrl(url: string): boolean {
  const githubPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+\/?$/;
  return githubPattern.test(url);
}

/**
 * Check if version follows semantic versioning
 */
function isValidVersion(version: string): boolean {
  const semverPattern = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
  return semverPattern.test(version);
}

/**
 * Generate registration summary for display
 */
export function generateRegistrationSummary(
  projectInfo: MCPProjectRegistration
): string {
  return `## 🚀 MCP Project Registration

**Project Details:**
- 📦 **Name**: ${projectInfo.name}
- 📝 **Description**: ${projectInfo.description}
- 🔗 **Repository**: ${projectInfo.repository}
- 🏷️ **Version**: ${projectInfo.version}
- 💻 **Language**: ${projectInfo.language}
- 🗂️ **Category**: ${projectInfo.category || "general"}
- 🏷️ **Tags**: ${projectInfo.tags?.join(", ") || "none"}

**Registration Status**: ✅ Ready for submission`;
}

/**
 * Check if project is eligible for auto-registration
 */
export function isEligibleForAutoRegistration(
  packageJson: PackageJsonType,
  hasValidStructure: boolean
): boolean {
  // Must have MCP SDK dependency
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const hasMcpDependency = deps["@modelcontextprotocol/sdk"] !== undefined;

  // Must have valid project structure
  const hasRequiredFields = Boolean(
    packageJson.name && packageJson.description && packageJson.version
  );

  // Must have MCP-related keywords or name
  const keywords = packageJson.keywords || [];
  const hasKeywordMcp = keywords.some(k => k.toLowerCase().includes("mcp"));
  const hasNameMcp = packageJson.name?.toLowerCase().includes("mcp") ?? false;
  const hasMcpKeywords = hasKeywordMcp || hasNameMcp;

  return (
    hasMcpDependency && hasValidStructure && hasRequiredFields && hasMcpKeywords
  );
}
