import {
  ProjectConfig,
  MCPFactoryProject,
  MCPProjectRegistration,
} from "./types.js";

/**
 * Extract project information from unified project config for registry
 */
export function extractProjectInfo(
  project: ProjectConfig | MCPFactoryProject,
  owner: string,
  repo: string
): MCPProjectRegistration {
  const now = new Date().toISOString();

  // Handle MCPFactoryProject
  if ("type" in project && project.type === "mcp-factory") {
    const mcpProject = project as MCPFactoryProject;

    // Extract dependencies for auto_detected
    const dependencies = extractDependencies(mcpProject);

    // Calculate quality score
    const qualityScore = calculateQualityScore(mcpProject);

    // Automatic approval/rejection decision (zero human intervention)
    const approvalResult = getAutomaticApprovalDecision(
      mcpProject,
      qualityScore
    );

    return {
      name: mcpProject.name,
      author: mcpProject.author || owner,
      description: mcpProject.description,
      repository: `https://github.com/${owner}/${repo}`,
      category: extractCategoryFromMCPFactoryProject(mcpProject),
      status: approvalResult.status,
      version: mcpProject.factoryVersion || mcpProject.version,
      registered_at: now,
      tags: mcpProject.keywords || [],
      dependencies: dependencies.mcpRelated.slice(0, 3), // Only keep first 3 MCP dependencies
      python_version: extractPythonVersion(mcpProject),
      license: mcpProject.license,
      quality_score: Math.round(qualityScore * 100), // Convert to 0-100 integer
    };
  }

  // Handle unified ProjectConfig (fallback for non-MCP Factory projects)
  const unifiedProject = project as ProjectConfig;
  const projectName = unifiedProject.name || repo;

  // Extract category from keywords for ProjectConfig
  const category = extractCategoryFromProjectConfig(unifiedProject);

  // Extract python version if it's a Python project
  const pythonVersion = unifiedProject.type === "python" ? "3.8" : undefined;

  // Non-MCP Factory projects are automatically rejected
  return {
    name: projectName,
    author: unifiedProject.author || owner,
    description: unifiedProject.description || "",
    repository: `https://github.com/${owner}/${repo}`,
    category: category,
    status: "rejected",
    registered_at: now,
    tags: unifiedProject.keywords || [],
    dependencies: [],
    python_version: pythonVersion,
    quality_score: 30, // Low score, because it's not an MCP Factory project
  };
}

/**
 * Generate simplified registration info - Generate simplified registration information
 * Remove debug and internal fields, keep only core information needed by Hub and users
 */
export function generateSimplifiedRegistration(
  project: ProjectConfig | MCPFactoryProject,
  owner: string,
  repo: string
): MCPProjectRegistration {
  const now = new Date().toISOString();

  // Extract basic info
  const projectName = project.name || repo;
  const projectDescription = project.description || "";
  const projectVersion = project.version;

  // Simplified MCP dependency extraction
  const mcpDependencies: string[] = [];
  if ("dependencies" in project && Array.isArray(project.dependencies)) {
    mcpDependencies.push(
      ...project.dependencies.filter(
        (dep: string) => dep.includes("mcp") || dep.includes("factory")
      )
    );
  }

  // Auto-approved high quality projects
  if (
    "type" in project &&
    project.type === "mcp-factory" &&
    "hasFactoryDependency" in project &&
    project.hasFactoryDependency &&
    "structureCompliance" in project &&
    project.structureCompliance >= 0.8
  ) {
    return {
      name: projectName,
      author: project.author || owner,
      description: projectDescription,
      repository: `https://github.com/${owner}/${repo}`,
      category: "server", // Simplified to default value
      status: "approved",
      registered_at: now,
      dependencies: mcpDependencies,
      python_version: "3.10", // Simplified to default value
      version: projectVersion,
      tags:
        "keywords" in project && Array.isArray(project.keywords)
          ? project.keywords
          : [],
    };
  }

  // Auto-rejected projects
  return {
    name: projectName,
    author: project.author || owner,
    description: projectDescription,
    repository: `https://github.com/${owner}/${repo}`,
    category: "server",
    status: "rejected",
    registered_at: now,
    dependencies: mcpDependencies,
    version: projectVersion,
    tags:
      "keywords" in project && Array.isArray(project.keywords)
        ? project.keywords
        : [],
  };
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
 * Validate project registration data
 */
export function validateRegistrationData(projectInfo: MCPProjectRegistration): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate name
  if (!projectInfo.name || projectInfo.name.trim().length === 0) {
    errors.push("Project name is required");
  } else if (projectInfo.name.length > 50) {
    errors.push("Project name must be 50 characters or less");
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

  // Validate author
  if (!projectInfo.author || projectInfo.author.trim().length === 0) {
    errors.push("Author is required");
  }

  // Validate category
  const validCategories = ["server", "tools", "resources", "prompts"];
  if (!validCategories.includes(projectInfo.category)) {
    errors.push(`Category must be one of: ${validCategories.join(", ")}`);
  }

  // Validate status
  const validStatuses = ["approved", "rejected"];
  if (!validStatuses.includes(projectInfo.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(", ")}`);
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
 * Generate registration summary for MCP Factory project
 */
export function generateRegistrationSummary(
  projectInfo: MCPProjectRegistration
): string {
  const capitalizeCategory = (cat: string) => {
    const categoryMap: Record<string, string> = {
      server: "Server",
      tools: "Tools",
      resources: "Resources",
      prompts: "Prompts",
    };
    return categoryMap[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  const versionInfo = projectInfo.version ? ` (v${projectInfo.version})` : "";

  return `📦 **${projectInfo.name}**
📝 ${projectInfo.description}
🔗 ${projectInfo.repository}
🏷️ Python • ${capitalizeCategory(projectInfo.category)}${versionInfo}
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
${projectInfo.version ? `- **Version**: ${projectInfo.version}` : ""}

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

/**
 * Extract dependency information from MCPFactoryProject
 */
function extractDependencies(project: MCPFactoryProject): {
  mcpRelated: string[];
  mainPackages: string[];
} {
  const allDeps = project.pyprojectConfig?.project?.dependencies || [];

  const mcpRelated = allDeps.filter(
    dep =>
      dep.includes("mcp") ||
      dep.includes("factory") ||
      dep.includes("anthropic")
  );

  const mainPackages = allDeps.slice(0, 8); // Take first 8 main dependencies

  return { mcpRelated, mainPackages };
}

/**
 * Extract Python version from MCPFactoryProject
 */
function extractPythonVersion(project: MCPFactoryProject): string | undefined {
  const requiresPython = project.pyprojectConfig?.project?.["requires-python"];
  if (requiresPython) {
    // Extract version number, e.g. ">=3.8" -> "3.8"
    const versionMatch = requiresPython.match(/(\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : undefined;
  }
  return undefined;
}

/**
 * Calculate project quality score
 */
function calculateQualityScore(project: MCPFactoryProject): number {
  let score = 0.5; // Base score

  // Structure compliance (40%)
  score += project.structureCompliance * 0.4;

  // Has MCP Factory dependency (30%)
  if (project.hasFactoryDependency) {
    score += 0.3;
  }

  // Has description and keywords (20%)
  if (project.description && project.description.length > 20) {
    score += 0.1;
  }
  if (project.keywords && project.keywords.length > 0) {
    score += 0.1;
  }

  // Has license (10%)
  if (project.license) {
    score += 0.1;
  }

  return Math.min(1.0, score);
}

/**
 * Fully automated approval/rejection decision (zero manual intervention)
 */
function getAutomaticApprovalDecision(
  project: MCPFactoryProject,
  qualityScore: number
): { status: "approved" | "rejected"; reason: string } {
  const reasons: string[] = [];

  // Check quality score threshold
  if (qualityScore < 0.7) {
    reasons.push(
      `Quality score too low: ${Math.round(qualityScore * 100)}% (minimum: 70%)`
    );
  }

  // Check structure compliance
  if (project.structureCompliance < 0.8) {
    reasons.push(
      `Structure compliance too low: ${Math.round(project.structureCompliance * 100)}% (minimum: 80%)`
    );
  }

  // Check MCP Factory dependency
  if (!project.hasFactoryDependency) {
    reasons.push("Missing MCP Factory dependency");
  }

  // Check core files
  if (!project.requiredFiles.pyprojectToml) {
    reasons.push("Missing pyproject.toml file");
  }
  if (!project.requiredFiles.serverPy) {
    reasons.push("Missing server.py file");
  }
  if (!project.requiredFiles.readme) {
    reasons.push("Missing README file");
  }

  // Check MCP directory count
  const mcpDirs = [
    project.requiredDirectories.tools,
    project.requiredDirectories.resources,
    project.requiredDirectories.prompts,
  ].filter(Boolean).length;

  if (mcpDirs < 1) {
    reasons.push("No MCP directories found (tools/, resources/, prompts/)");
  }

  // Check project description
  if (!project.description || project.description.length < 20) {
    reasons.push("Description too short (minimum: 20 characters)");
  }

  // Automatic decision
  if (reasons.length === 0) {
    return {
      status: "approved",
      reason: `Automatically approved: Quality ${Math.round(qualityScore * 100)}%, Structure ${Math.round(project.structureCompliance * 100)}%, ${mcpDirs} MCP directories`,
    };
  } else {
    return {
      status: "rejected",
      reason: `Automatically rejected: ${reasons.join("; ")}`,
    };
  }
}

/**
 * Extract category from ProjectConfig based on keywords
 */
function extractCategoryFromProjectConfig(
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

  // Default to server for ProjectConfig
  return "server";
}
