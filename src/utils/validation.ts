import { Octokit } from "@octokit/rest";
import TOML from "@iarna/toml";
import {
  MCPFactoryProject,
  MCPFactoryPyProject,
  ValidationResult,
  MCPDetectionResult,
  FileContent,
} from "./types.js";

// Required structure for MCP Factory projects
const REQUIRED_FILES = ["pyproject.toml", "server.py", "README.md"] as const;

const REQUIRED_DIRECTORIES = ["tools", "resources", "prompts"] as const;

const OPTIONAL_FILES = [
  "config.yaml",
  "CHANGELOG.md",
  ".env",
  ".gitignore",
] as const;

/**
 * Parse pyproject.toml content for MCP Factory projects
 */
function parseMCPFactoryPyProjectToml(
  content: string
): MCPFactoryPyProject | null {
  try {
    const parsed = TOML.parse(content) as MCPFactoryPyProject;
    return parsed;
  } catch (error) {
    console.error("Failed to parse pyproject.toml:", error);
    return null;
  }
}

/**
 * Check if project has MCP Factory dependency
 */
function hasFactoryDependency(pyproject: MCPFactoryPyProject): boolean {
  const dependencies = pyproject.project?.dependencies || [];
  return dependencies.some(
    dep => typeof dep === "string" && dep.includes("mcp-factory")
  );
}

/**
 * Detect MCP Factory project from repository files
 */
export async function detectMCPFactoryProject(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref = "HEAD"
): Promise<MCPDetectionResult> {
  try {
    const reasons: string[] = [];
    let confidence = 0;
    let projectData: MCPFactoryProject | undefined;

    // Check for pyproject.toml (essential for factory projects)
    let pyprojectContent: string;
    try {
      const pyprojectResponse = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: "pyproject.toml",
        ref,
      });

      if ("content" in pyprojectResponse.data) {
        pyprojectContent = Buffer.from(
          pyprojectResponse.data.content,
          "base64"
        ).toString("utf-8");
      } else {
        reasons.push("pyproject.toml not found - not a Python project");
        return { isMCPProject: false, confidence: 0, reasons };
      }
    } catch (error) {
      reasons.push("pyproject.toml not found - not a Python project");
      return { isMCPProject: false, confidence: 0, reasons };
    }

    // Parse pyproject.toml
    const pyprojectConfig = parseMCPFactoryPyProjectToml(pyprojectContent);
    if (!pyprojectConfig || !pyprojectConfig.project) {
      reasons.push("Invalid pyproject.toml format");
      return { isMCPProject: false, confidence: 0.1, reasons };
    }

    // Check for MCP Factory dependency (primary indicator)
    const hasFactory = hasFactoryDependency(pyprojectConfig);
    if (!hasFactory) {
      reasons.push("Missing mcp-factory dependency in pyproject.toml");
      return { isMCPProject: false, confidence: 0.2, reasons };
    }

    confidence += 0.6; // High confidence for factory dependency
    reasons.push("Found mcp-factory dependency");

    // Check project structure compliance
    const structureCheck = await checkProjectStructure(
      octokit,
      owner,
      repo,
      ref
    );
    confidence += structureCheck.compliance * 0.4; // Remaining 40% for structure

    reasons.push(...structureCheck.reasons);

    // Extract project information
    const project = pyprojectConfig.project;
    if (!project.name || !project.description) {
      reasons.push("Missing required project name or description");
      confidence *= 0.8; // Reduce confidence for incomplete metadata
    }

    // Build project data
    projectData = {
      type: "mcp-factory",
      name: project.name || repo,
      version: project.version || "1.0.0",
      description: project.description || "",
      hasFactoryDependency: hasFactory,
      structureCompliance: structureCheck.compliance,
      keywords: project.keywords || [],
      author: project.authors?.[0]?.name,
      license:
        typeof project.license === "string"
          ? project.license
          : project.license?.text,
      requiredFiles: structureCheck.files,
      requiredDirectories: structureCheck.directories,
      pyprojectConfig,
    };

    const isMCPProject = confidence >= 0.8;

    if (isMCPProject) {
      reasons.push("High confidence MCP Factory project detected");
    } else {
      reasons.push(
        `Confidence too low (${(confidence * 100).toFixed(1)}%) for MCP Factory project`
      );
    }

    return {
      isMCPProject,
      confidence,
      reasons,
      projectData: isMCPProject ? projectData : undefined,
    };
  } catch (error) {
    console.error("Error detecting MCP Factory project:", error);
    return {
      isMCPProject: false,
      confidence: 0,
      reasons: [
        `Detection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    };
  }
}

/**
 * Check MCP Factory project structure compliance
 */
async function checkProjectStructure(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
) {
  const compliance = { score: 0, max: 0 };
  const reasons: string[] = [];

  const files = {
    pyprojectToml: false,
    serverPy: false,
    configYaml: false,
    readme: false,
  };

  const directories = {
    tools: false,
    resources: false,
    prompts: false,
  };

  // Check required files
  for (const fileName of REQUIRED_FILES) {
    compliance.max += 1;
    try {
      await octokit.rest.repos.getContent({
        owner,
        repo,
        path: fileName,
        ref,
      });

      compliance.score += 1;
      reasons.push(`Found required file: ${fileName}`);

      // Update file flags
      if (fileName === "pyproject.toml") files.pyprojectToml = true;
      if (fileName === "server.py") files.serverPy = true;
      if (fileName === "README.md") files.readme = true;
    } catch (error) {
      reasons.push(`Missing required file: ${fileName}`);
    }
  }

  // Check required directories
  for (const dirName of REQUIRED_DIRECTORIES) {
    compliance.max += 1;
    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: dirName,
        ref,
      });

      if (Array.isArray(response.data)) {
        compliance.score += 1;
        reasons.push(`Found required directory: ${dirName}/`);

        // Update directory flags
        if (dirName === "tools") directories.tools = true;
        if (dirName === "resources") directories.resources = true;
        if (dirName === "prompts") directories.prompts = true;
      }
    } catch (error) {
      reasons.push(`Missing required directory: ${dirName}/`);
    }
  }

  // Check optional files (bonus points)
  for (const fileName of OPTIONAL_FILES) {
    try {
      await octokit.rest.repos.getContent({
        owner,
        repo,
        path: fileName,
        ref,
      });

      reasons.push(`Found optional file: ${fileName}`);

      if (fileName === "config.yaml") {
        files.configYaml = true;
      }
    } catch (error) {
      // Optional files don't affect compliance score
    }
  }

  const complianceRatio =
    compliance.max > 0 ? compliance.score / compliance.max : 0;

  return {
    compliance: complianceRatio,
    reasons,
    files,
    directories,
  };
}

/**
 * Validate MCP Factory project data
 */
export function validateMCPFactoryProject(
  project: MCPFactoryProject
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!project.name || project.name.trim().length === 0) {
    errors.push("Project name is required");
  } else if (project.name.length > 100) {
    errors.push("Project name must be 100 characters or less");
  }

  if (!project.description || project.description.trim().length === 0) {
    errors.push("Project description is required");
  } else if (project.description.length > 500) {
    errors.push("Project description must be 500 characters or less");
  }

  if (!project.version || project.version.trim().length === 0) {
    errors.push("Project version is required");
  }

  // Validate MCP Factory dependency
  if (!project.hasFactoryDependency) {
    errors.push("Project must have mcp-factory dependency");
  }

  // Validate structure compliance
  if (project.structureCompliance < 0.8) {
    errors.push("Project structure does not meet MCP Factory standards");
  } else if (project.structureCompliance < 1.0) {
    warnings.push("Project structure is incomplete but acceptable");
  }

  // Validate required files
  if (!project.requiredFiles.pyprojectToml) {
    errors.push("Missing required file: pyproject.toml");
  }
  if (!project.requiredFiles.serverPy) {
    errors.push("Missing required file: server.py");
  }
  if (!project.requiredFiles.readme) {
    warnings.push("Missing README.md file");
  }

  // Validate required directories
  if (!project.requiredDirectories.tools) {
    warnings.push("Missing tools/ directory");
  }
  if (!project.requiredDirectories.resources) {
    warnings.push("Missing resources/ directory");
  }
  if (!project.requiredDirectories.prompts) {
    warnings.push("Missing prompts/ directory");
  }

  // Calculate score
  const score = Math.max(0, 100 - errors.length * 25 - warnings.length * 5);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score,
  };
}

/**
 * Validate MCP Factory project for auto-registration eligibility
 */
export function validateMCPFactoryProjectForRegistration(
  project: MCPFactoryProject
): ValidationResult {
  const result = validateMCPFactoryProject(project);

  // Additional checks for registration
  if (result.isValid) {
    // Check for MCP-related keywords or description content
    const description = project.description.toLowerCase();
    const keywords = (project.keywords || []).map(k => k.toLowerCase());

    const mcpKeywords = [
      "mcp",
      "model context protocol",
      "server",
      "tool",
      "resource",
      "prompt",
    ];
    const hasMCPContent = mcpKeywords.some(
      keyword => description.includes(keyword) || keywords.includes(keyword)
    );

    if (!hasMCPContent) {
      result.warnings.push(
        "Project description should mention MCP or related functionality"
      );
      result.score = Math.max(0, (result.score || 100) - 10);
    }
  }

  return result;
}

/**
 * Get repository file content
 */
export async function getRepositoryFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref = "HEAD"
): Promise<FileContent | null> {
  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if ("content" in response.data) {
      return {
        path,
        content: Buffer.from(response.data.content, "base64").toString("utf-8"),
        encoding: "utf-8",
      };
    }

    return null;
  } catch (error) {
    console.error(`Failed to get file content for ${path}:`, error);
    return null;
  }
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use detectMCPFactoryProject instead
 */
export const detectMCPFactory = detectMCPFactoryProject;

/**
 * Legacy function name for backward compatibility
 * @deprecated Use validateMCPFactoryProject instead
 */
export const validateMCPFactory = validateMCPFactoryProject;

/**
 * Unified project detection and validation functions
 */

import {
  ProjectConfig,
  PackageJsonType,
  PyProjectConfig,
  PythonSetupConfig,
  UnifiedMCPDetectionResult,
} from "./types.js";

/**
 * Parse pyproject.toml content for unified project detection
 */
export function parsePyProjectToml(content: string): PyProjectConfig | null {
  try {
    const parsed = TOML.parse(content) as PyProjectConfig;
    return parsed;
  } catch (error) {
    console.error("Failed to parse pyproject.toml:", error);
    return null;
  }
}

/**
 * Parse setup.py content (basic extraction)
 */
export function parseSetupPy(content: string): PythonSetupConfig | null {
  try {
    // Basic regex-based parsing for setup() parameters
    const setupMatch = content.match(/setup\s*\(\s*([\s\S]*?)\s*\)$/);
    if (!setupMatch) return null;

    const config: PythonSetupConfig = {};
    const setupContent = setupMatch[1];

    // Extract common fields using regex
    const extractField = (field: string) => {
      const regex = new RegExp(`${field}\\s*=\\s*['"](.*?)['"]`, "i");
      const match = setupContent.match(regex);
      return match ? match[1] : undefined;
    };

    const extractListField = (field: string) => {
      const regex = new RegExp(`${field}\\s*=\\s*\\[(.*?)\\]`, "i");
      const match = setupContent.match(regex);
      if (!match) return [];

      return match[1]
        .split(",")
        .map(item => item.trim().replace(/['"]/g, ""))
        .filter(item => item.length > 0);
    };

    config.name = extractField("name");
    config.version = extractField("version");
    config.description = extractField("description");
    config.author = extractField("author");
    config.license = extractField("license");
    config.url = extractField("url");
    config.install_requires = extractListField("install_requires");
    config.keywords = extractListField("keywords");

    return config;
  } catch (error) {
    console.error("Failed to parse setup.py:", error);
    return null;
  }
}

/**
 * Detect project configuration from GitHub context
 */
export async function detectProjectConfig(
  context: any
): Promise<ProjectConfig | null> {
  const { octokit, payload } = context;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;

  try {
    // Try Python first (pyproject.toml)
    try {
      const pyprojectResponse = await octokit.repos.getContent({
        owner,
        repo,
        path: "pyproject.toml",
      });

      if ("content" in pyprojectResponse.data) {
        const content = Buffer.from(
          pyprojectResponse.data.content,
          "base64"
        ).toString();

        try {
          const pyprojectConfig = parsePyProjectToml(content);

          if (pyprojectConfig === null) {
            // Invalid TOML content
            throw new Error("Invalid project configuration");
          }

          if (pyprojectConfig?.project) {
            return {
              type: "python",
              name: pyprojectConfig.project.name || repo,
              description: pyprojectConfig.project.description,
              version: pyprojectConfig.project.version,
              keywords: pyprojectConfig.project.keywords,
              dependencies: pyprojectConfig.project.dependencies,
              author: pyprojectConfig.project.authors?.[0]?.name,
              license:
                typeof pyprojectConfig.project.license === "string"
                  ? pyprojectConfig.project.license
                  : pyprojectConfig.project.license?.text,
              source: "pyproject.toml",
              pyprojectConfig,
            };
          }
        } catch (parseError) {
          // TOML parsing failed
          throw new Error("Invalid project configuration");
        }
      }
    } catch (error) {
      // Check if this is a TOML parsing error
      if (
        error instanceof Error &&
        error.message === "Invalid project configuration"
      ) {
        throw error;
      }
      // pyproject.toml not found, continue
    }

    // Try Python (setup.py)
    try {
      const setupResponse = await octokit.repos.getContent({
        owner,
        repo,
        path: "setup.py",
      });

      if ("content" in setupResponse.data) {
        const content = Buffer.from(
          setupResponse.data.content,
          "base64"
        ).toString();
        const setupConfig = parseSetupPy(content);

        if (setupConfig?.name) {
          return {
            type: "python",
            name: setupConfig.name,
            description: setupConfig.description,
            version: setupConfig.version,
            keywords: setupConfig.keywords,
            dependencies: setupConfig.install_requires,
            author: setupConfig.author,
            license: setupConfig.license,
            source: "setup.py",
            setupConfig,
          };
        }
      }
    } catch (error) {
      // setup.py not found, continue
    }

    // Try Node.js (package.json)
    try {
      const packageResponse = await octokit.repos.getContent({
        owner,
        repo,
        path: "package.json",
      });

      if ("content" in packageResponse.data) {
        const content = Buffer.from(
          packageResponse.data.content,
          "base64"
        ).toString();
        const packageJson: PackageJsonType = JSON.parse(content);

        const dependencies = Object.keys({
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        });

        return {
          type: "nodejs",
          name: packageJson.name,
          description: packageJson.description,
          version: packageJson.version,
          keywords: packageJson.keywords,
          dependencies,
          author:
            typeof packageJson.author === "string"
              ? packageJson.author
              : packageJson.author?.name,
          license: packageJson.license,
          source: "package.json",
          packageJson,
        };
      }
    } catch (error) {
      // package.json not found
    }

    return null;
  } catch (error) {
    // Re-throw specific configuration errors
    if (
      error instanceof Error &&
      error.message === "Invalid project configuration"
    ) {
      throw error;
    }
    console.error("Error detecting project config:", error);
    return null;
  }
}

/**
 * Detect if a project is MCP-related
 */
export function detectMCPProject(
  projectConfig: ProjectConfig,
  filePaths: string[] = []
): UnifiedMCPDetectionResult {
  const reasons: string[] = [];
  let isMCPProject = false;

  // Check dependencies
  if (projectConfig.dependencies) {
    const mcpDeps = projectConfig.dependencies.filter(
      dep =>
        dep.includes("@modelcontextprotocol") ||
        dep.includes("mcp") ||
        dep.includes("fastapi") ||
        dep.includes("uvicorn")
    );

    if (mcpDeps.length > 0) {
      isMCPProject = true;
      if (projectConfig.type === "nodejs") {
        reasons.push("Has MCP SDK dependency");
      } else {
        reasons.push("Has MCP or FastAPI dependency");
      }
    }
  }

  // Check keywords
  const keywords = projectConfig.keywords || [];
  const mcpKeywords = keywords.filter(
    keyword =>
      keyword.toLowerCase().includes("mcp") ||
      keyword.toLowerCase().includes("model-context-protocol") ||
      keyword.toLowerCase().includes("context") ||
      keyword.toLowerCase().includes("protocol")
  );

  if (mcpKeywords.length > 0) {
    isMCPProject = true;
    reasons.push("Has MCP-related keywords");
  }

  // Check description
  if (projectConfig.description) {
    const description = projectConfig.description.toLowerCase();
    if (
      description.includes("mcp") ||
      description.includes("model context protocol") ||
      description.includes("context protocol")
    ) {
      isMCPProject = true;
      reasons.push("MCP keywords in description");
    }
  }

  // Check project name
  const name = projectConfig.name.toLowerCase();
  if (name.includes("mcp") || name.includes("context")) {
    isMCPProject = true;
    reasons.push("MCP keywords in name");
  }

  // Check file structure for MCP-specific patterns
  const mcpFiles = filePaths.filter(
    path =>
      path.includes("mcp") ||
      path.includes("model-context-protocol") ||
      path.includes("context-protocol") ||
      path.toLowerCase().includes("mcp_server") ||
      path.toLowerCase().includes("mcp-server") ||
      path.toLowerCase().includes("mcp.config") ||
      path.toLowerCase().includes("mcp_config")
  );

  if (mcpFiles.length > 0) {
    isMCPProject = true;
    reasons.push("Has MCP-related files");
  }

  return {
    isMCPProject,
    reasons,
    confidence: isMCPProject ? Math.min(100, reasons.length * 25) : 0,
    projectData: isMCPProject ? projectConfig : undefined,
  };
}

/**
 * Validate project configuration from context (async version for tests)
 */
export async function validateProject(context: any): Promise<ValidationResult> {
  try {
    const projectConfig = await detectProjectConfig(context);
    return validateProjectConfig(projectConfig);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to detect project configuration";
    return {
      isValid: false,
      errors: [errorMessage],
      warnings: [],
    };
  }
}

/**
 * Validate unified project configuration (sync version)
 */
export function validateProjectConfig(
  projectConfig: ProjectConfig | null
): ValidationResult {
  if (!projectConfig) {
    return {
      isValid: false,
      errors: ["No project configuration found"],
      warnings: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!projectConfig.name) {
    errors.push("Project name is required");
  }

  if (!projectConfig.version) {
    warnings.push("Missing version");
  }

  if (!projectConfig.description) {
    warnings.push("Missing description");
  }

  if (!projectConfig.keywords || projectConfig.keywords.length === 0) {
    warnings.push("Missing keywords");
  }

  // Type-specific validation
  if (projectConfig.type === "nodejs" && !projectConfig.packageJson) {
    errors.push("Invalid package.json configuration");
  }

  if (
    projectConfig.type === "python" &&
    !projectConfig.pyprojectConfig &&
    !projectConfig.setupConfig
  ) {
    errors.push("Invalid Python project configuration");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
