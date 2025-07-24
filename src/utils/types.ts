import { Context } from "probot";

/**
 * Extended Probot Context type
 */
export type ProbotContext = Context;

/**
 * Package.json type definition for Node.js projects
 */
export interface PackageJsonType {
  name: string;
  description?: string;
  version?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  author?: string | { name: string; email?: string };
  license?: string;
  main?: string;
  repository?: string | { type: string; url: string };
  bugs?: string | { url: string };
  homepage?: string;
  [key: string]: any;
}

/**
 * Python pyproject.toml configuration
 */
export interface PyProjectConfig {
  project?: {
    name?: string;
    version?: string;
    description?: string;
    keywords?: string[];
    dependencies?: string[];
    authors?: Array<{ name: string; email?: string }>;
    license?: string | { text: string };
    readme?: string;
    "requires-python"?: string;
    [key: string]: any;
  };
  "build-system"?: {
    requires?: string[];
    "build-backend"?: string;
  };
  tool?: Record<string, any>;
  [key: string]: any;
}

/**
 * Python setup.py configuration
 */
export interface PythonSetupConfig {
  name?: string;
  version?: string;
  description?: string;
  keywords?: string[];
  install_requires?: string[];
  author?: string;
  author_email?: string;
  license?: string;
  long_description?: string;
  url?: string;
  classifiers?: string[];
  [key: string]: any;
}

/**
 * Unified project configuration interface
 */
export interface ProjectConfig {
  type: "nodejs" | "python";
  name: string;
  description?: string;
  version?: string;
  keywords?: string[];
  dependencies?: string[];
  author?: string;
  license?: string;
  source: "package.json" | "pyproject.toml" | "setup.py";

  // Type-specific configurations
  packageJson?: PackageJsonType;
  pyprojectConfig?: PyProjectConfig;
  setupConfig?: PythonSetupConfig;
}

/**
 * MCP Detection Result for unified projects
 */
export interface UnifiedMCPDetectionResult {
  isMCPProject: boolean;
  reasons: string[];
  confidence?: number;
  projectData?: ProjectConfig;
}

/**
 * GitHub Issues event payload type
 */
export interface IssuesPayload {
  action: "opened" | "closed" | "labeled" | "unlabeled" | "edited";
  issue: {
    id: number;
    number: number;
    title: string;
    body?: string;
    state: "open" | "closed";
    labels: Array<{
      id: number;
      name: string;
      color: string;
    }>;
  };
  label?: {
    id: number;
    name: string;
    color: string;
  };
  installation: {
    id: number;
    account: {
      login: string;
      id: number;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
      id: number;
    };
  };
}

/**
 * GitHub Pull Request event payload type
 */
export interface PullRequestPayload {
  action: "opened" | "closed" | "synchronize" | "reopened";
  pull_request: {
    id: number;
    number: number;
    title: string;
    body?: string;
    state: "open" | "closed";
    merged: boolean;
    head: {
      sha: string;
      ref: string;
    };
    base: {
      sha: string;
      ref: string;
    };
  };
  installation: {
    id: number;
    account: {
      login: string;
      id: number;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
      id: number;
    };
  };
}

/**
 * GitHub Push event payload type
 */
export interface PushPayload {
  ref: string;
  commits: Array<{
    id: string;
    message: string;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  installation: {
    id: number;
    account: {
      login: string;
      id: number;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
      id: number;
    };
  };
}

/**
 * GitHub Release event payload type
 */
export interface ReleasePayload {
  action: "published" | "created" | "edited" | "deleted";
  release: {
    id: number;
    tag_name: string;
    name: string;
    body?: string;
    prerelease: boolean;
    draft: boolean;
    published_at?: string;
    author?: {
      login: string;
      id: number;
    };
  };
  installation: {
    id: number;
    account: {
      login: string;
      id: number;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    owner: {
      login: string;
      id: number;
    };
  };
}

/**
 * GitHub Installation event payload type
 */
export interface InstallationPayload {
  action: "created" | "deleted";
  installation: {
    id: number;
    account: {
      login: string;
      id: number;
      type: string;
    };
    permissions?: Record<string, string>;
  };
}

/**
 * MCP Factory PyProject configuration interface
 * Represents the pyproject.toml structure for MCP Factory projects
 */
export interface MCPFactoryPyProject {
  project?: {
    name?: string;
    version?: string;
    description?: string;
    readme?: string;
    authors?: Array<{
      name: string;
      email?: string;
    }>;
    license?: string | { text: string };
    keywords?: string[];
    dependencies?: string[];
    "requires-python"?: string;
    "optional-dependencies"?: Record<string, string[]>;
  };
  "build-system"?: {
    requires?: string[];
    "build-backend"?: string;
  };
  tool?: Record<string, any>;
  [key: string]: unknown;
}

/**
 * MCP Factory project configuration
 * Represents a project created by MCP Factory with standardized structure
 */
export interface MCPFactoryProject {
  type: "mcp-factory";
  name: string;
  version: string;
  description: string;

  // Factory-specific properties
  factoryVersion?: string;
  hasFactoryDependency: boolean;

  // Standard project properties
  keywords?: string[];
  author?: string;
  license?: string;

  // Structure compliance
  structureCompliance: number; // 0-1 score
  requiredFiles: {
    pyprojectToml: boolean;
    serverPy: boolean;
    configYaml?: boolean;
    readme: boolean;
  };

  requiredDirectories: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };

  // Raw configuration
  pyprojectConfig: MCPFactoryPyProject;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score?: number;
}

/**
 * MCP Factory project detection result
 */
export interface MCPDetectionResult {
  isMCPProject: boolean;
  confidence: number;
  reasons: string[];
  projectData?: MCPFactoryProject;
}

/**
 * File content interface for repository operations
 */
export interface FileContent {
  path: string;
  content: string;
  message?: string;
  encoding?: "utf-8" | "base64";
}

/**
 * Repository creation options
 */
export interface RepositoryCreateOptions {
  description?: string;
  private?: boolean;
  autoInit?: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
}

/**
 * MCP Factory project registration interface
 */
export interface MCPProjectRegistration {
  // Core project information
  name: string;
  author: string;
  description: string;
  repository: string;

  // Category and status
  category: "server" | "tools" | "resources" | "prompts";
  status: "approved" | "rejected";

  // Version and time
  version?: string;
  registered_at: string;

  // Utility information
  tags: string[];
  dependencies: string[]; // Direct array, no hierarchy

  // Technical information (remove language, keep only specific python version)
  python_version?: string;
  license?: string;

  // Simplified quality information (if needed to display to users)
  quality_score?: number; // Integer from 0-100
}

/**
 * Publish request interface for MCP Factory projects
 */
export interface PublishRequest {
  projectName: string;
  description?: string;
  version?: string;
  language: "python"; // MCP Factory only creates Python projects
  category?: "server" | "tools" | "resources" | "prompts";
  tags?: string[];
  files: Array<{ path: string; content: string }>;
  mcpFactoryProject?: MCPFactoryProject;
  owner?: string;
  repoName?: string;
}
