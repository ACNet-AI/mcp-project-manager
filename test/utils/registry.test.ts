import { describe, test, expect } from "vitest";
import {
  extractProjectInfo,
  validateRegistrationData,
  generateRegistrationSummary,
  isEligibleForAutoRegistration,
} from "../../src/utils/registry";
import type {
  PackageJsonType,
  MCPProjectRegistration,
} from "../../src/utils/types";

describe("Registry Utils", () => {
  describe("extractProjectInfo", () => {
    test("should extract project info from package.json", () => {
      const packageJson: PackageJsonType = {
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server", "ai"],
        dependencies: {
          "@modelcontextprotocol/sdk": "^1.0.0",
          typescript: "^5.0.0",
        },
      };

      const result = extractProjectInfo(
        packageJson,
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

    test("should handle missing package.json fields", () => {
      const packageJson: PackageJsonType = {};

      const result = extractProjectInfo(packageJson, "testuser", "test-repo");

      expect(result).toEqual({
        name: "test-repo",
        description: "",
        repository: "https://github.com/testuser/test-repo",
        version: "1.0.0",
        language: "javascript",
        category: "general",
        tags: [],
      });
    });

    test("should detect TypeScript from dependencies", () => {
      const packageJson: PackageJsonType = {
        name: "test-project",
        devDependencies: {
          typescript: "^5.0.0",
        },
      };

      const result = extractProjectInfo(
        packageJson,
        "testuser",
        "test-project"
      );

      expect(result.language).toBe("typescript");
    });

    test("should detect Python from name", () => {
      const packageJson: PackageJsonType = {
        name: "test-python-project",
      };

      const result = extractProjectInfo(
        packageJson,
        "testuser",
        "test-python-project"
      );

      expect(result.language).toBe("python");
    });

    test("should detect React projects as TypeScript", () => {
      const packageJson: PackageJsonType = {
        name: "test-react-app",
        dependencies: {
          react: "^18.0.0",
        },
      };

      const result = extractProjectInfo(
        packageJson,
        "testuser",
        "test-react-app"
      );

      expect(result.language).toBe("typescript");
    });

    test("should extract category from keywords", () => {
      const testCases = [
        { keywords: ["database", "mcp"], expectedCategory: "database" },
        { keywords: ["api", "server"], expectedCategory: "api" },
        { keywords: ["web", "frontend"], expectedCategory: "web" },
        { keywords: ["cli", "tool"], expectedCategory: "tools" },
        { keywords: ["utility", "helper"], expectedCategory: "utilities" },
        {
          keywords: ["integration", "webhook"],
          expectedCategory: "integrations",
        },
        { keywords: ["ai", "ml"], expectedCategory: "ai" },
        { keywords: ["machine-learning", "nlp"], expectedCategory: "ai" },
        { keywords: ["random", "stuff"], expectedCategory: "general" },
      ];

      testCases.forEach(({ keywords, expectedCategory }) => {
        const packageJson: PackageJsonType = { keywords };
        const result = extractProjectInfo(
          packageJson,
          "testuser",
          "test-project"
        );
        expect(result.category).toBe(expectedCategory);
      });
    });
  });

  describe("validateRegistrationData", () => {
    test("should validate valid registration data", () => {
      const validData: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
        category: "server",
        tags: ["mcp", "server"],
      };

      const result = validateRegistrationData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should reject empty name", () => {
      const invalidData: MCPProjectRegistration = {
        name: "",
        description: "A test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
        category: "server",
        tags: ["mcp", "server"],
      };

      const result = validateRegistrationData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Project name is required");
    });

    test("should reject empty description", () => {
      const invalidData: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
        category: "server",
        tags: ["mcp", "server"],
      };

      const result = validateRegistrationData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Project description is required");
    });

    test("should reject invalid GitHub URL", () => {
      const invalidData: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "https://gitlab.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
        category: "server",
        tags: ["mcp", "server"],
      };

      const result = validateRegistrationData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Valid GitHub repository URL is required"
      );
    });

    test("should reject invalid version format", () => {
      const invalidData: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0",
        language: "typescript",
        category: "server",
        tags: ["mcp", "server"],
      };

      const result = validateRegistrationData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Valid semantic version is required");
    });

    test("should validate complex semantic versions", () => {
      const testCases = [
        { version: "1.0.0", expected: true },
        { version: "1.0.0-alpha", expected: true },
        { version: "1.0.0-beta.1", expected: true },
        { version: "1.0.0+build.1", expected: true },
        { version: "1.0.0-alpha+beta", expected: true },
        { version: "1.0", expected: false },
        { version: "1.0.0.0", expected: false },
        { version: "v1.0.0", expected: false },
        { version: "1.0.0-", expected: false },
        { version: "1.0.0+", expected: false },
      ];

      testCases.forEach(({ version, expected }) => {
        const data: MCPProjectRegistration = {
          name: "test-mcp-server",
          description: "A test MCP server",
          repository: "https://github.com/testuser/test-mcp-server",
          version,
          language: "typescript",
          category: "server",
          tags: ["mcp", "server"],
        };

        const result = validateRegistrationData(data);
        expect(result.isValid).toBe(expected);
      });
    });
  });

  describe("generateRegistrationSummary", () => {
    test("should generate registration summary", () => {
      const projectInfo: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
        category: "server",
        tags: ["mcp", "server"],
      };

      const summary = generateRegistrationSummary(projectInfo);

      expect(summary).toContain("🚀 MCP Project Registration");
      expect(summary).toContain("test-mcp-server");
      expect(summary).toContain("A test MCP server");
      expect(summary).toContain("https://github.com/testuser/test-mcp-server");
      expect(summary).toContain("1.0.0");
      expect(summary).toContain("typescript");
      expect(summary).toContain("server");
      expect(summary).toContain("mcp, server");
      expect(summary).toContain("✅ Ready for submission");
    });

    test("should handle empty tags", () => {
      const projectInfo: MCPProjectRegistration = {
        name: "test-mcp-server",
        description: "A test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        version: "1.0.0",
        language: "typescript",
        category: "server",
        tags: [],
      };

      const summary = generateRegistrationSummary(projectInfo);

      expect(summary).toContain("none");
    });
  });

  describe("isEligibleForAutoRegistration", () => {
    test("should return true for eligible project", () => {
      const packageJson: PackageJsonType = {
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server"],
        dependencies: {
          "@modelcontextprotocol/sdk": "^1.0.0",
        },
      };

      const result = isEligibleForAutoRegistration(packageJson, true);

      expect(result).toBe(true);
    });

    test("should return false without MCP dependency", () => {
      const packageJson: PackageJsonType = {
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server"],
      };

      const result = isEligibleForAutoRegistration(packageJson, true);

      expect(result).toBe(false);
    });

    test("should return false without valid structure", () => {
      const packageJson: PackageJsonType = {
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server"],
        dependencies: {
          "@modelcontextprotocol/sdk": "^1.0.0",
        },
      };

      const result = isEligibleForAutoRegistration(packageJson, false);

      expect(result).toBe(false);
    });

    test("should return false without required fields", () => {
      const packageJson: PackageJsonType = {
        keywords: ["mcp", "server"],
        dependencies: {
          "@modelcontextprotocol/sdk": "^1.0.0",
        },
      };

      const result = isEligibleForAutoRegistration(packageJson, true);

      expect(result).toBe(false);
    });

    test("should return false without MCP keywords", () => {
      const packageJson: PackageJsonType = {
        name: "test-server",
        description: "A test server",
        version: "1.0.0",
        keywords: ["server", "api"],
        dependencies: {
          "@modelcontextprotocol/sdk": "^1.0.0",
        },
      };

      const result = isEligibleForAutoRegistration(packageJson, true);

      expect(result).toBe(false);
    });

    test("should return true with MCP in project name", () => {
      const packageJson: PackageJsonType = {
        name: "my-mcp-server",
        description: "A test server",
        version: "1.0.0",
        keywords: ["server", "api"],
        dependencies: {
          "@modelcontextprotocol/sdk": "^1.0.0",
        },
      };

      const result = isEligibleForAutoRegistration(packageJson, true);

      expect(result).toBe(true);
    });

    test("should check devDependencies for MCP SDK", () => {
      const packageJson: PackageJsonType = {
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        keywords: ["mcp", "server"],
        devDependencies: {
          "@modelcontextprotocol/sdk": "^1.0.0",
        },
      };

      const result = isEligibleForAutoRegistration(packageJson, true);

      expect(result).toBe(true);
    });
  });
});
