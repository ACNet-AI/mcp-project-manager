import { describe, test, expect } from "vitest";
import {
  extractProjectInfo,
  validateRegistrationData,
  generateRegistrationSummary,
  isEligibleForAutoRegistration,
} from "../../src/utils/registry";
import type {
  ProjectConfig,
  MCPProjectRegistration,
} from "../../src/utils/types";

describe("Registry Utils", () => {
  describe("extractProjectInfo", () => {
    test("should extract project info from Node.js project config", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server", "ai"],
        dependencies: ["@modelcontextprotocol/sdk", "typescript"],
        source: "package.json",
      };

      const result = extractProjectInfo(
        projectConfig,
        "testuser",
        "test-mcp-server"
      );

      expect(result).toEqual({
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
        category: "server",
        tags: ["mcp", "server", "ai"],
      });
    });

    test("should extract project info from Python project config", () => {
      const projectConfig: ProjectConfig = {
        type: "python",
        name: "test-mcp-python-server",
        description: "A test Python MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server", "python"],
        dependencies: ["fastapi", "uvicorn"],
        source: "pyproject.toml",
      };

      const result = extractProjectInfo(
        projectConfig,
        "testuser",
        "test-mcp-python-server"
      );

      expect(result).toEqual({
        name: "test-mcp-python-server",
        description: "A test Python MCP server",
        repository: "https://github.com/testuser/test-mcp-python-server",
        version: "1.0.0",
        language: "python",
        category: "server",
        tags: ["mcp", "server", "python"],
      });
    });

    test("should handle missing project config fields", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        source: "package.json",
      };

      const result = extractProjectInfo(projectConfig, "testuser", "test-repo");

      expect(result).toEqual({
        name: "test-repo",
        description: "",
        repository: "https://github.com/testuser/test-repo",
        version: "1.0.0",
        language: "javascript",
        category: "server",
        tags: [],
      });
    });

    test("should detect TypeScript from dependencies", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-project",
        dependencies: ["typescript"],
        source: "package.json",
      };

      const result = extractProjectInfo(
        projectConfig,
        "testuser",
        "test-project"
      );

      expect(result.language).toBe("typescript");
    });

    test("should detect Python from project type", () => {
      const projectConfig: ProjectConfig = {
        type: "python",
        name: "test-python-project",
        source: "pyproject.toml",
      };

      const result = extractProjectInfo(
        projectConfig,
        "testuser",
        "test-python-project"
      );

      expect(result.language).toBe("python");
    });

    test("should detect React projects as TypeScript", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-react-app",
        dependencies: ["react"],
        source: "package.json",
      };

      const result = extractProjectInfo(
        projectConfig,
        "testuser",
        "test-react-app"
      );

      expect(result.language).toBe("typescript");
    });

    test("should extract category from keywords", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-tool",
        keywords: ["mcp", "tool", "utility"],
        source: "package.json",
      };

      const result = extractProjectInfo(projectConfig, "testuser", "test-tool");

      expect(result.category).toBe("tools");
    });
  });

  describe("validateRegistrationData", () => {
    test("should validate valid registration data", () => {
      const projectInfo: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
        category: "server",
        tags: ["mcp", "server"],
      };

      const result = validateRegistrationData(projectInfo);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("should detect invalid GitHub URL", () => {
      const projectInfo: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "invalid-url",
        version: "1.0.0",
        language: "typescript",
      };

      const result = validateRegistrationData(projectInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid GitHub repository URL");
    });

    test("should detect invalid version", () => {
      const projectInfo: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "invalid-version",
        language: "typescript",
      };

      const result = validateRegistrationData(projectInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid version format");
    });

    test("should detect missing required fields", () => {
      const projectInfo: MCPProjectRegistration = {
        name: "",
        description: "",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
      };

      const result = validateRegistrationData(projectInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Project name is required");
      expect(result.errors).toContain("Project description is required");
    });

    test("should detect too long description", () => {
      const projectInfo: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A".repeat(501),
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
      };

      const result = validateRegistrationData(projectInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Description is too long (max 500 characters)"
      );
    });

    test("should detect invalid language", () => {
      const projectInfo: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "invalid-language",
      };

      const result = validateRegistrationData(projectInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid language: invalid-language");
    });
  });

  describe("generateRegistrationSummary", () => {
    test("should generate summary for TypeScript project", () => {
      const projectInfo: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
        category: "server",
        tags: ["mcp", "server"],
      };

      const result = generateRegistrationSummary(projectInfo);

      expect(result).toContain("test-mcp-server");
      expect(result).toContain("TypeScript");
      expect(result).toContain("Server");
      expect(result).toContain("A test MCP server");
    });

    test("should generate summary for Python project", () => {
      const projectInfo: MCPProjectRegistration = {
        name: "test-python-server",
        description: "A Python MCP server",
        repository: "https://github.com/testuser/test-python-server",
        version: "2.0.0",
        language: "python",
        category: "server",
        tags: ["mcp", "python"],
      };

      const result = generateRegistrationSummary(projectInfo);

      expect(result).toContain("test-python-server");
      expect(result).toContain("Python");
      expect(result).toContain("Server");
      expect(result).toContain("A Python MCP server");
    });
  });

  describe("isEligibleForAutoRegistration", () => {
    test("should return true for eligible Node.js project", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server"],
        dependencies: ["@modelcontextprotocol/sdk"],
        source: "package.json",
      };

      const result = isEligibleForAutoRegistration(projectConfig, true);

      expect(result).toBe(true);
    });

    test("should return true for eligible Python project", () => {
      const projectConfig: ProjectConfig = {
        type: "python",
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server"],
        dependencies: ["fastapi", "uvicorn"],
        source: "pyproject.toml",
      };

      const result = isEligibleForAutoRegistration(projectConfig, true);

      expect(result).toBe(true);
    });

    test("should return false without MCP dependency", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-server",
        description: "A test server",
        version: "1.0.0",
        keywords: ["mcp", "server"],
        dependencies: ["express"],
        source: "package.json",
      };

      const result = isEligibleForAutoRegistration(projectConfig, true);

      expect(result).toBe(false);
    });

    test("should return false without valid structure", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server"],
        dependencies: ["@modelcontextprotocol/sdk"],
        source: "package.json",
      };

      const result = isEligibleForAutoRegistration(projectConfig, false);

      expect(result).toBe(false);
    });

    test("should return false without required fields", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "",
        description: "",
        keywords: ["mcp", "server"],
        dependencies: ["@modelcontextprotocol/sdk"],
        source: "package.json",
      };

      const result = isEligibleForAutoRegistration(projectConfig, true);

      expect(result).toBe(false);
    });

    test("should return false without MCP keywords", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-server",
        description: "A test server",
        version: "1.0.0",
        keywords: ["server", "tool"],
        dependencies: ["@modelcontextprotocol/sdk"],
        source: "package.json",
      };

      const result = isEligibleForAutoRegistration(projectConfig, true);

      expect(result).toBe(false);
    });

    test("should return true with MCP in project name", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "my-mcp-tool",
        description: "A test tool",
        version: "1.0.0",
        keywords: ["tool"],
        dependencies: ["@modelcontextprotocol/sdk"],
        source: "package.json",
      };

      const result = isEligibleForAutoRegistration(projectConfig, true);

      expect(result).toBe(true);
    });

    test("should check Python MCP dependencies", () => {
      const projectConfig: ProjectConfig = {
        type: "python",
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server"],
        dependencies: ["mcp-core", "fastapi"],
        source: "pyproject.toml",
      };

      const result = isEligibleForAutoRegistration(projectConfig, true);

      expect(result).toBe(true);
    });
  });
});
