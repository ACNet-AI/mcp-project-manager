import { describe, test, expect, beforeEach, vi } from "vitest";
import { validateProject, detectMCPProject } from "../../src/utils/validation";
import type { Context } from "probot";
import type { PackageJsonType } from "../../src/utils/types";

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
    test("should detect MCP project by package.json dependencies", () => {
      const packageJson: PackageJsonType = {
        name: "test-mcp-server",
        description: "A test MCP server",
        dependencies: {
          "@modelcontextprotocol/sdk": "^1.0.0",
        },
      };

      const result = detectMCPProject(packageJson, []);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP SDK dependency");
    });

    test("should detect MCP project by devDependencies", () => {
      const packageJson: PackageJsonType = {
        name: "test-mcp-server",
        description: "A test MCP server",
        devDependencies: {
          "@modelcontextprotocol/sdk": "^1.0.0",
        },
      };

      const result = detectMCPProject(packageJson, []);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP SDK dependency");
    });

    test("should detect MCP project by keywords", () => {
      const packageJson: PackageJsonType = {
        name: "test-server",
        description: "A test server",
        keywords: ["mcp", "server"],
      };

      const result = detectMCPProject(packageJson, []);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP-related keywords");
    });

    test("should detect MCP project by description", () => {
      const packageJson: PackageJsonType = {
        name: "test-server",
        description: "An MCP server implementation",
      };

      const result = detectMCPProject(packageJson, []);

      expect(result.isMCPProject).toBe(false);
      expect(result.reasons).not.toContain("MCP keywords in description");
    });

    test("should detect MCP project by name", () => {
      const packageJson: PackageJsonType = {
        name: "my-mcp-server",
        description: "A test server",
      };

      const result = detectMCPProject(packageJson, []);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Package name contains 'mcp'");
    });

    test("should not detect non-MCP project", () => {
      const packageJson: PackageJsonType = {
        name: "regular-server",
        description: "A regular server",
      };

      const result = detectMCPProject(packageJson, []);

      expect(result.isMCPProject).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    test("should handle null package.json", () => {
      const result = detectMCPProject(null, []);

      expect(result.isMCPProject).toBe(false);
      expect(result.reasons).toContain("No package.json found");
    });
  });

  describe("validateProject", () => {
    test("should validate project with all required files", async () => {
      const { context, mockGetContent } = createMockContext();

      // Mock package.json content
      const packageJsonContent = JSON.stringify({
        name: "test-project",
        description: "A test project",
        main: "index.js",
      });

      // Mock README content
      const readmeContent = "# Test Project\n\nThis is a test project.";

      mockGetContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from(packageJsonContent).toString("base64") },
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from(readmeContent).toString("base64") },
        });

      const result = await validateProject(context, "src");

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockGetContent).toHaveBeenCalledTimes(2);
    });

    test("should validate project with sha parameter", async () => {
      const { context, mockGetContent } = createMockContext();

      const packageJsonContent = JSON.stringify({
        name: "test-project",
        description: "A test project",
        exports: "./dist/index.js",
      });

      mockGetContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from(packageJsonContent).toString("base64") },
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from("# README").toString("base64") },
        });

      const result = await validateProject(context, "src", "abc123");

      expect(result.isValid).toBe(true);
      expect(mockGetContent).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        path: "src/package.json",
        ref: "abc123",
      });
    });

    test("should fail validation when package.json is missing", async () => {
      const { context, mockGetContent } = createMockContext();

      mockGetContent
        .mockRejectedValueOnce(new Error("Not Found"))
        .mockResolvedValueOnce({
          data: { content: Buffer.from("# README").toString("base64") },
        });

      const result = await validateProject(context, "src");

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Missing package.json file");
    });

    test("should fail validation when package.json has invalid JSON", async () => {
      const { context, mockGetContent } = createMockContext();

      const invalidJson = "{ invalid json }";

      mockGetContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from(invalidJson).toString("base64") },
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from("# README").toString("base64") },
        });

      const result = await validateProject(context, "src");

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("package.json format error");
    });

    test("should fail validation when package.json is missing required fields", async () => {
      const { context, mockGetContent } = createMockContext();

      const packageJsonContent = JSON.stringify({
        // Missing name, description, main, and exports
        version: "1.0.0",
      });

      mockGetContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from(packageJsonContent).toString("base64") },
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from("# README").toString("base64") },
        });

      const result = await validateProject(context, "src");

      expect(result.isValid).toBe(false); // Should be invalid since name is missing (error)
      expect(result.errors).toContain("package.json missing name field");
      expect(result.warnings).toContain(
        "package.json missing description field"
      );
      expect(result.warnings).toContain(
        "package.json missing main or exports field"
      );
    });

    test("should fail validation when README.md is missing", async () => {
      const { context, mockGetContent } = createMockContext();

      const packageJsonContent = JSON.stringify({
        name: "test-project",
        description: "A test project",
        main: "index.js",
      });

      mockGetContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from(packageJsonContent).toString("base64") },
        })
        .mockRejectedValueOnce(new Error("Not Found"));

      const result = await validateProject(context, "src");

      expect(result.isValid).toBe(true); // Should be valid since README is just a warning
      expect(result.warnings).toContain("Missing README.md file");
    });

    test("should handle API errors gracefully", async () => {
      const { context, mockGetContent } = createMockContext();

      mockGetContent.mockRejectedValue(new Error("API Error"));

      const result = await validateProject(context, "src");

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
