import {
  MCPProjectRegistration,
  MCPFactoryProject,
  ProjectConfig,
} from "./types.js";

/**
 * MCP Factory Project Registry utilities
 */

// Valid languages for projects
const VALID_LANGUAGES = ["python", "typescript", "javascript"] as const;

// Valid categories for projects
const VALID_CATEGORIES = ["server", "tools", "resources", "prompts"] as const;

/**
 * Extract project information from unified project config for registry
 */
export function extractProjectInfo(
  project: ProjectConfig | MCPFactoryProject,
  owner: string,
  repo: string
): MCPProjectRegistration {
  // Handle MCPFactoryProject
  if ("type" in project && project.type === "mcp-factory") {
    const mcpProject = project as MCPFactoryProject;
    return {
      name: mcpProject.name,
      description: mcpProject.description,
      repository: `https://github.com/${owner}/${repo}`,
      version: mcpProject.version,
      language: "python", // MCP Factory only creates Python projects
      category: extractCategoryFromMCPFactoryProject(mcpProject),
      tags: mcpProject.keywords || [],
      factoryVersion: mcpProject.factoryVersion,
    };
  }

  // Handle unified ProjectConfig
  const unifiedProject = project as ProjectConfig;
  const projectName = unifiedProject.name || repo;
  return {
    name: projectName,
    description: unifiedProject.description || "",
    repository: `https://github.com/${owner}/${repo}`,
    version: unifiedProject.version || "1.0.0",
    language: detectLanguageFromProject(unifiedProject),
    category: extractCategoryFromUnifiedProject(unifiedProject),
    tags: unifiedProject.keywords || [],
  };
}

/**
 * Detect language from unified project config
 */
function detectLanguageFromProject(
  project: ProjectConfig
): "python" | "typescript" | "javascript" {
  if (project.type === "python") {
    return "python";
  }

  if (project.type === "nodejs") {
    // Check dependencies to determine if TypeScript or JavaScript
    const deps = project.dependencies || [];
    if (
      deps.some(
        dep =>
          dep.includes("typescript") ||
          dep.includes("@types/") ||
          dep.includes("ts-")
      )
    ) {
      return "typescript";
    }

    // Check if React project (typically TypeScript)
    if (deps.some(dep => dep.includes("react"))) {
      return "typescript";
    }

    return "javascript";
  }

  return "typescript";
}

/**
 * Extract category from unified project
 */
function extractCategoryFromUnifiedProject(
  project: ProjectConfig
): "server" | "tools" | "resources" | "prompts" {
  const keywords = (project.keywords || []).map(k => k.toLowerCase());
  const description = (project.description || "").toLowerCase();

  // Check keywords first
  if (keywords.includes("server") || description.includes("server")) {
    return "server";
  }

  if (
    keywords.includes("tools") ||
    keywords.includes("tool") ||
    description.includes("tool")
  ) {
    return "tools";
  }

  if (
    keywords.includes("resources") ||
    keywords.includes("resource") ||
    description.includes("resource")
  ) {
    return "resources";
  }

  if (
    keywords.includes("prompts") ||
    keywords.includes("prompt") ||
    description.includes("prompt")
  ) {
    return "prompts";
  }

  // Default based on project name
  const name = (project.name || "").toLowerCase();
  if (name.includes("tool")) return "tools";
  if (name.includes("resource")) return "resources";
  if (name.includes("prompt")) return "prompts";

  return "server"; // Default to server
}

/**
 * Extract category from MCP Factory project
 * Priority: server > tools > resources > prompts
 */
function extractCategoryFromMCPFactoryProject(
  project: MCPFactoryProject
): "server" | "tools" | "resources" | "prompts" {
  const keywords = (project.keywords || []).map(k => k.toLowerCase());
  const description = (project.description || "").toLowerCase();

  // Check keywords first
  if (keywords.includes("server") || description.includes("server")) {
    return "server";
  }

  if (
    keywords.includes("tools") ||
    keywords.includes("tool") ||
    description.includes("tool")
  ) {
    return "tools";
  }

  if (
    keywords.includes("resources") ||
    keywords.includes("resource") ||
    description.includes("resource")
  ) {
    return "resources";
  }

  if (
    keywords.includes("prompts") ||
    keywords.includes("prompt") ||
    description.includes("prompt")
  ) {
    return "prompts";
  }

  // Default to server for MCP Factory projects
  return "server";
}

/**
 * Validate MCP Factory project registration data
 */
export function validateRegistrationData(projectInfo: MCPProjectRegistration): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate name
  if (!projectInfo.name || projectInfo.name.trim().length === 0) {
    errors.push("Project name is required");
  } else if (projectInfo.name.length > 100) {
    errors.push("Project name must be 100 characters or less");
  }

  // Validate description
  if (!projectInfo.description || projectInfo.description.trim().length === 0) {
    errors.push("Project description is required");
  } else if (projectInfo.description.length > 500) {
    errors.push("Description is too long (max 500 characters)");
  }

  // Validate repository URL
  if (!projectInfo.repository || !isValidGitHubUrl(projectInfo.repository)) {
    errors.push("Invalid GitHub repository URL");
  }

  // Validate version
  if (!projectInfo.version || !isValidVersion(projectInfo.version)) {
    errors.push("Invalid version format");
  }

  // Validate language
  if (!VALID_LANGUAGES.includes(projectInfo.language as any)) {
    errors.push(`Invalid language: ${projectInfo.language}`);
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(projectInfo.category as any)) {
    errors.push(`Category must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if GitHub URL is valid
 */
function isValidGitHubUrl(url: string): boolean {
  const githubUrlPattern =
    /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/;
  return githubUrlPattern.test(url);
}

/**
 * Check if version follows semantic versioning
 */
function isValidVersion(version: string): boolean {
  const semverPattern = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
  return semverPattern.test(version);
}

/**
 * Generate registration summary for MCP Factory project
 */
export function generateRegistrationSummary(
  projectInfo: MCPProjectRegistration
): string {
  const capitalizeLanguage = (lang: string) => {
    const languageMap: Record<string, string> = {
      python: "Python",
      typescript: "TypeScript",
      javascript: "JavaScript",
    };
    return languageMap[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  const capitalizeCategory = (cat: string) => {
    const categoryMap: Record<string, string> = {
      server: "Server",
      tools: "Tools",
      resources: "Resources",
      prompts: "Prompts",
    };
    return categoryMap[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  const factoryInfo = projectInfo.factoryVersion
    ? ` (MCP Factory ${projectInfo.factoryVersion})`
    : " (MCP Factory)";

  return `📦 **${projectInfo.name}** v${projectInfo.version}
📝 ${projectInfo.description}
🔗 ${projectInfo.repository}
🏷️ ${capitalizeLanguage(projectInfo.language)} • ${capitalizeCategory(projectInfo.category)}${factoryInfo}
${projectInfo.tags && projectInfo.tags.length > 0 ? `🏷️ ${projectInfo.tags.join(" • ")}` : ""}`;
}

/**
 * Check if MCP Factory project is eligible for auto-registration
 */
export function isEligibleForAutoRegistration(
  project: ProjectConfig | MCPFactoryProject,
  isMCPProject: boolean = false
): boolean {
  // Handle MCPFactoryProject
  if ("type" in project && project.type === "mcp-factory") {
    const mcpProject = project as MCPFactoryProject;

    // Basic structure requirements
    if (!mcpProject.hasFactoryDependency) {
      return false;
    }

    // Structure compliance must be high
    if (mcpProject.structureCompliance < 0.8) {
      return false;
    }

    // Must have required files
    if (
      !mcpProject.requiredFiles.pyprojectToml ||
      !mcpProject.requiredFiles.serverPy
    ) {
      return false;
    }

    // Must have at least 2 of 3 required directories
    const dirCount = [
      mcpProject.requiredDirectories.tools,
      mcpProject.requiredDirectories.resources,
      mcpProject.requiredDirectories.prompts,
    ].filter(Boolean).length;

    if (dirCount < 2) {
      return false;
    }

    // Must have meaningful metadata
    if (!mcpProject.name || mcpProject.name.length < 3) {
      return false;
    }

    if (!mcpProject.description || mcpProject.description.length < 10) {
      return false;
    }

    return true;
  }

  // Handle unified ProjectConfig
  const unifiedProject = project as ProjectConfig;

  // Must be identified as MCP project
  if (!isMCPProject) {
    return false;
  }

  // Basic requirements
  if (!unifiedProject.name || unifiedProject.name.length < 3) {
    return false;
  }

  if (!unifiedProject.description || unifiedProject.description.length < 10) {
    return false;
  }

  // Check for MCP dependencies
  const dependencies = unifiedProject.dependencies || [];
  const hasMCPDep = dependencies.some(
    dep =>
      dep.includes("@modelcontextprotocol") ||
      dep.includes("mcp") ||
      dep.includes("fastapi") ||
      dep.includes("uvicorn")
  );

  if (!hasMCPDep) {
    return false;
  }

  // Check for MCP keywords
  const keywords = unifiedProject.keywords || [];
  const description = unifiedProject.description || "";
  const name = unifiedProject.name || "";

  const mcpKeywords = keywords.some(
    k =>
      k.toLowerCase().includes("mcp") ||
      k.toLowerCase().includes("context") ||
      k.toLowerCase().includes("protocol")
  );

  const mcpInText =
    description.toLowerCase().includes("mcp") ||
    name.toLowerCase().includes("mcp");

  return hasMCPDep && (mcpKeywords || mcpInText);
}

/**
 * Generate GitHub issue content for manual registration
 */
export function generateRegistrationIssue(
  projectInfo: MCPProjectRegistration,
  reasons: string[]
): string {
  return `# 🔄 Manual Registration Request

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
}

/**
 * Validate project tags/keywords for MCP relevance
 */
export function validateMCPRelevance(project: MCPFactoryProject): {
  isRelevant: boolean;
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  // Base score for having factory dependency (primary indicator)
  if (project.hasFactoryDependency) {
    score += 60;
    reasons.push("Has mcp-factory dependency");
  }

  // Check description for MCP keywords
  const description = project.description.toLowerCase();
  const mcpKeywords = [
    "mcp",
    "model context protocol",
    "server",
    "tool",
    "resource",
    "prompt",
  ];

  for (const keyword of mcpKeywords) {
    if (description.includes(keyword)) {
      score += 10;
      reasons.push(`Description mentions "${keyword}"`);
    }
  }

  // Check project keywords
  const keywords = (project.keywords || []).map(k => k.toLowerCase());
  for (const keyword of mcpKeywords) {
    if (keywords.includes(keyword)) {
      score += 5;
      reasons.push(`Has "${keyword}" keyword`);
    }
  }

  // Check project name
  const name = project.name.toLowerCase();
  if (name.includes("mcp")) {
    score += 15;
    reasons.push("Project name contains 'mcp'");
  }

  // Structure compliance bonus
  if (project.structureCompliance >= 0.9) {
    score += 10;
    reasons.push("High structure compliance");
  }

  return {
    isRelevant: score >= 70,
    score,
    reasons,
  };
}
