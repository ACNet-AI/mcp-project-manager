import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  validateProject,
  detectMCPProject,
  detectProjectConfig,
} from "../../src/utils/validation";
import type { Context } from "probot";
import type { ProjectConfig } from "../../src/utils/types";

// Mock context helper
function createMockContext() {
  const mockGetContent = vi.fn();
  return {
    context: {
      octokit: {
        repos: {
          getContent: mockGetContent,
        },
      },
      payload: {
        repository: {
          owner: { login: "testuser" },
          name: "test-repo",
        },
      },
      log: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    } as any,
    mockGetContent,
  };
}

describe("Validation Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectMCPProject", () => {
    test("should detect MCP project by Node.js dependencies", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-mcp-server",
        description: "A test MCP server",
        dependencies: ["@modelcontextprotocol/sdk"],
        source: "package.json",
      };

      const result = detectMCPProject(projectConfig, []);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP SDK dependency");
    });

    test("should detect MCP project by Python dependencies", () => {
      const projectConfig: ProjectConfig = {
        type: "python",
        name: "test-mcp-server",
        description: "A test MCP server",
        dependencies: ["mcp-core", "fastapi"],
        source: "pyproject.toml",
      };

      const result = detectMCPProject(projectConfig, []);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP or FastAPI dependency");
    });

    test("should detect MCP project by keywords", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-server",
        description: "A test server",
        keywords: ["mcp", "server"],
        source: "package.json",
      };

      const result = detectMCPProject(projectConfig, []);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP-related keywords");
    });

    test("should detect MCP project by description", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-server",
        description: "An MCP server implementation",
        source: "package.json",
      };

      const result = detectMCPProject(projectConfig, []);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("MCP keywords in description");
    });

    test("should detect MCP project by name", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "my-mcp-server",
        description: "A test server",
        source: "package.json",
      };

      const result = detectMCPProject(projectConfig, []);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("MCP keywords in name");
    });

    test("should detect MCP project by Python file structure", () => {
      const projectConfig: ProjectConfig = {
        type: "python",
        name: "test-server",
        description: "A test server",
        source: "pyproject.toml",
      };

      const result = detectMCPProject(projectConfig, [
        "src/mcp_server.py",
        "pyproject.toml",
      ]);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP-related files");
    });

    test("should detect MCP project by Node.js file structure", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-server",
        description: "A test server",
        source: "package.json",
      };

      const result = detectMCPProject(projectConfig, [
        "src/server.ts",
        "mcp.config.js",
      ]);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP-related files");
    });

    test("should not detect MCP project without indicators", () => {
      const projectConfig: ProjectConfig = {
        type: "nodejs",
        name: "test-server",
        description: "A regular server",
        dependencies: ["express"],
        source: "package.json",
      };

      const result = detectMCPProject(projectConfig, ["src/server.ts"]);

      expect(result.isMCPProject).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe("detectProjectConfig", () => {
    test("should detect Python project from pyproject.toml", async () => {
      const { context, mockGetContent } = createMockContext();

      mockGetContent.mockResolvedValueOnce({
        data: {
          content: Buffer.from(
            `
[project]
name = "test-mcp-server"
version = "1.0.0"
description = "A test MCP server"
keywords = ["mcp", "server"]
dependencies = ["fastapi", "uvicorn"]
          `
          ).toString("base64"),
          encoding: "base64",
        },
      });

      const result = await detectProjectConfig(context);

      expect(result).toBeDefined();
      expect(result?.type).toBe("python");
      expect(result?.name).toBe("test-mcp-server");
      expect(result?.version).toBe("1.0.0");
      expect(result?.description).toBe("A test MCP server");
      expect(result?.keywords).toEqual(["mcp", "server"]);
      expect(result?.dependencies).toEqual(["fastapi", "uvicorn"]);
      expect(result?.source).toBe("pyproject.toml");
    });

    test("should detect Node.js project from package.json", async () => {
      const { context, mockGetContent } = createMockContext();

      // First call fails (no pyproject.toml)
      mockGetContent.mockRejectedValueOnce(new Error("Not found"));

      // Second call fails (no setup.py)
      mockGetContent.mockRejectedValueOnce(new Error("Not found"));

      // Third call succeeds (package.json)
      mockGetContent.mockResolvedValueOnce({
        data: {
          content: Buffer.from(
            JSON.stringify({
              name: "test-mcp-server",
              version: "1.0.0",
              description: "A test MCP server",
              keywords: ["mcp", "server"],
              dependencies: {
                "@modelcontextprotocol/sdk": "^1.0.0",
                typescript: "^5.0.0",
              },
            })
          ).toString("base64"),
          encoding: "base64",
        },
      });

      const result = await detectProjectConfig(context);

      expect(result).toBeDefined();
      expect(result?.type).toBe("nodejs");
      expect(result?.name).toBe("test-mcp-server");
      expect(result?.version).toBe("1.0.0");
      expect(result?.description).toBe("A test MCP server");
      expect(result?.keywords).toEqual(["mcp", "server"]);
      expect(result?.dependencies).toEqual([
        "@modelcontextprotocol/sdk",
        "typescript",
      ]);
      expect(result?.source).toBe("package.json");
    });

    test("should return null when no project config found", async () => {
      const { context, mockGetContent } = createMockContext();

      // All calls fail
      mockGetContent.mockRejectedValue(new Error("Not found"));

      const result = await detectProjectConfig(context);

      expect(result).toBeNull();
    });
  });

  describe("validateProject", () => {
    test("should validate valid Python project", async () => {
      const { context, mockGetContent } = createMockContext();

      mockGetContent.mockResolvedValueOnce({
        data: {
          content: Buffer.from(
            `
[project]
name = "test-mcp-server"
version = "1.0.0"
description = "A test MCP server"
keywords = ["mcp", "server"]
dependencies = ["fastapi", "uvicorn"]
          `
          ).toString("base64"),
          encoding: "base64",
        },
      });

      const result = await validateProject(context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test("should validate valid Node.js project", async () => {
      const { context, mockGetContent } = createMockContext();

      // First call fails (no pyproject.toml)
      mockGetContent.mockRejectedValueOnce(new Error("Not found"));

      // Second call fails (no setup.py)
      mockGetContent.mockRejectedValueOnce(new Error("Not found"));

      // Third call succeeds (package.json)
      mockGetContent.mockResolvedValueOnce({
        data: {
          content: Buffer.from(
            JSON.stringify({
              name: "test-mcp-server",
              version: "1.0.0",
              description: "A test MCP server",
              keywords: ["mcp", "server"],
              dependencies: {
                "@modelcontextprotocol/sdk": "^1.0.0",
              },
            })
          ).toString("base64"),
          encoding: "base64",
        },
      });

      const result = await validateProject(context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test("should return invalid for missing project config", async () => {
      const { context, mockGetContent } = createMockContext();

      // All calls fail
      mockGetContent.mockRejectedValue(new Error("Not found"));

      const result = await validateProject(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("No project configuration found");
    });

    test("should return warnings for missing fields", async () => {
      const { context, mockGetContent } = createMockContext();

      mockGetContent.mockResolvedValueOnce({
        data: {
          content: Buffer.from(
            `
[project]
name = "test-server"
          `
          ).toString("base64"),
          encoding: "base64",
        },
      });

      const result = await validateProject(context);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Missing description");
      expect(result.warnings).toContain("Missing version");
      expect(result.warnings).toContain("Missing keywords");
    });

    test("should return errors for invalid configuration", async () => {
      const { context, mockGetContent } = createMockContext();

      mockGetContent.mockResolvedValueOnce({
        data: {
          content: Buffer.from(
            `
[project]
# Invalid TOML content
name = 
          `
          ).toString("base64"),
          encoding: "base64",
        },
      });

      const result = await validateProject(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid project configuration");
    });
  });
});
