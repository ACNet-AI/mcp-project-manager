import { Context } from "probot";

/**
 * Extended Probot Context type
 */
export type ProbotContext = Context;

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
 * Package.json type definition
 */
export interface PackageJsonType {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  module?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  keywords?: string[];
  author?:
    | string
    | {
        name: string;
        email?: string;
        url?: string;
      };
  license?: string;
  repository?:
    | string
    | {
        type: string;
        url: string;
      };
  [key: string]: unknown;
}

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score?: number;
}

/**
 * MCP detection result type
 */
export interface MCPDetectionResult {
  isMCPProject: boolean;
  confidence: number;
  reasons: string[];
  suggestedCategory?: string;
}

/**
 * File content type
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
 * MCP project registration info
 */
export interface MCPProjectRegistration {
  name: string;
  description: string;
  repository: string;
  version: string;
  language: string;
  category?: string;
  tags?: string[];
}

/**
 * Publish request interface
 */
export interface PublishRequest {
  projectName: string;
  description?: string;
  version?: string;
  language: string;
  category?: string;
  tags?: string[];
  files: Array<{ path: string; content: string }>;
  packageJson?: PackageJsonType;
  owner?: string;
  repoName?: string;
}
