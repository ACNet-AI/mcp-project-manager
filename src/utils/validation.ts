import { ProbotContext, PackageJsonType } from "../types";

/**
 * Project structure validation
 */
export async function validateProject(
  context: ProbotContext,
  projectPath: string,
  sha?: string
): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Check package.json
    const packageJsonPath = `${projectPath}/package.json`;
    const packageJsonContent = await getFileContent(context, packageJsonPath, sha);

    if (!packageJsonContent) {
      errors.push("Missing package.json file");
    } else {
      try {
        const packageJson: PackageJsonType = JSON.parse(packageJsonContent);
        if (!packageJson.name) errors.push("package.json missing name field");
        if (!packageJson.description) errors.push("package.json missing description field");
        if (!packageJson.main && !packageJson["exports"]) {
          errors.push("package.json missing main or exports field");
        }
      } catch {
        errors.push("package.json format error");
      }
    }

    // Check README.md
    const readmePath = `${projectPath}/README.md`;
    const readmeContent = await getFileContent(context, readmePath, sha);
    if (!readmeContent) {
      errors.push("Missing README.md file");
    }
  } catch (error) {
    errors.push(
      `Validation process error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Detect MCP project type
 */
export function detectMCPProject(
  packageJson: PackageJsonType | null,
  files: string[]
): { isMCP: boolean; type: string; confidence: number } {
  if (!packageJson) {
    return { isMCP: false, type: "unknown", confidence: 0 };
  }

  let confidence = 0;
  let type = "unknown";

  // Check dependencies
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};

  if (deps["@modelcontextprotocol/sdk"] || devDeps["@modelcontextprotocol/sdk"]) {
    confidence += 50;
    type = "mcp-server";
  }

  // Check keywords
  const keywords = packageJson.keywords || [];
  if (keywords.includes("mcp") || keywords.includes("model-context-protocol")) {
    confidence += 30;
  }

  // Check file structure
  const hasIndex = files.some(f => f.match(/^(index|main)\.(js|ts)$/));
  if (hasIndex) confidence += 10;

  const hasConfig = files.some(f => f.includes("mcp") || f.includes("config"));
  if (hasConfig) confidence += 10;

  return {
    isMCP: confidence >= 40,
    type,
    confidence,
  };
}

// Helper function: get file content
async function getFileContent(
  context: ProbotContext,
  path: string,
  sha?: string
): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = context.payload as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
