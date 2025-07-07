import {
  ProbotContext,
  PackageJsonType,
  ValidationResult,
  MCPDetectionResult,
} from "./types.js";

/**
 * Project structure validation
 */
export async function validateProject(
  context: ProbotContext,
  projectPath: string = "",
  sha?: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check package.json
    const packageJsonPath = projectPath
      ? `${projectPath}/package.json`
      : "package.json";
    const packageJsonContent = await getFileContent(
      context,
      packageJsonPath,
      sha
    );

    if (!packageJsonContent) {
      errors.push("Missing package.json file");
    } else {
      try {
        const packageJson: PackageJsonType = JSON.parse(packageJsonContent);
        if (!packageJson.name) errors.push("package.json missing name field");
        if (!packageJson.description)
          warnings.push("package.json missing description field");
        if (!packageJson.main && !packageJson["exports"]) {
          warnings.push("package.json missing main or exports field");
        }
      } catch {
        errors.push("package.json format error");
      }
    }

    // Check README.md
    const readmePath = projectPath ? `${projectPath}/README.md` : "README.md";
    const readmeContent = await getFileContent(context, readmePath, sha);
    if (!readmeContent) {
      warnings.push("Missing README.md file");
    }
  } catch (error) {
    errors.push(
      `Validation process error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: Math.max(0, 100 - errors.length * 25 - warnings.length * 10),
  };
}

/**
 * Detect MCP project type
 */
export function detectMCPProject(
  packageJson: PackageJsonType | null,
  files: string[]
): MCPDetectionResult {
  if (!packageJson) {
    return {
      isMCPProject: false,
      confidence: 0,
      reasons: ["No package.json found"],
      suggestedCategory: "unknown",
    };
  }

  let confidence = 0;
  const reasons: string[] = [];
  let suggestedCategory = "general";

  // Check dependencies
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};

  if (
    deps["@modelcontextprotocol/sdk"] ||
    devDeps["@modelcontextprotocol/sdk"]
  ) {
    confidence += 50;
    reasons.push("Has MCP SDK dependency");
    suggestedCategory = "server";
  }

  // Check keywords
  const keywords = packageJson.keywords || [];
  const hasRelevantKeywords = keywords.some(
    keyword =>
      keyword.toLowerCase().includes("mcp") ||
      keyword.toLowerCase().includes("model-context-protocol")
  );
  if (hasRelevantKeywords) {
    confidence += 40;
    reasons.push("Has MCP-related keywords");
  }

  // Check file structure
  const hasIndex = files.some(f => f.match(/^(index|main)\.(js|ts)$/));
  if (hasIndex) {
    confidence += 10;
    reasons.push("Has main entry file");
  }

  const hasConfig = files.some(f => f.includes("mcp") || f.includes("config"));
  if (hasConfig) {
    confidence += 10;
    reasons.push("Has MCP configuration files");
  }

  // Check package name
  if (packageJson.name?.includes("mcp")) {
    confidence += 40;
    reasons.push("Package name contains 'mcp'");
  }

  return {
    isMCPProject: confidence >= 40,
    confidence,
    reasons,
    suggestedCategory,
  };
}

/**
 * Helper function: get file content
 */
async function getFileContent(
  context: ProbotContext,
  path: string,
  sha?: string
): Promise<string | null> {
  try {
    const payload = context.payload as any;
    const params: any = {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      path,
    };

    if (sha) {
      params.ref = sha;
    }

    const response = await context.octokit.repos.getContent(params);

    if ("content" in response.data) {
      return Buffer.from(response.data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}
