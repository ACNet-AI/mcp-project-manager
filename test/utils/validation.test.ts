import { describe, test, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig, MCPFactoryProject } from "../../src/utils/types";
import {
  detectProjectConfig,
  detectMCPProject,
  parsePyProjectToml,
  parseSetupPy,
  validateProject,
  validateProjectConfig,
  getRepositoryFileContent,
  detectMCPFactoryProject,
  validateMCPFactoryProject,
  validateMCPFactoryProjectForRegistration,
} from "../../src/utils/validation";

describe("Validation Utils - Additional Coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectProjectConfig Edge Cases", () => {
    test("should handle project with only package.json", async () => {
      const mockContext = {
        octokit: {
          repos: {
            getContent: vi.fn(),
          },
        },
        payload: {
          repository: {
            owner: { login: "testuser" },
            name: "simple-project",
          },
        },
      };

      // Mock: pyproject.toml not found, setup.py not found, package.json found
      mockContext.octokit.repos.getContent
        .mockRejectedValueOnce(new Error("pyproject.toml not found"))
        .mockRejectedValueOnce(new Error("setup.py not found"))
        .mockResolvedValueOnce({
          data: {
            content: Buffer.from(
              JSON.stringify({
                name: "simple-project",
                version: "1.0.0",
                description: "A simple Node.js project",
                author: "Test User",
                license: "MIT",
                dependencies: {
                  express: "^4.18.0",
                },
              })
            ).toString("base64"),
          },
        });

      const result = await detectProjectConfig(mockContext);

      expect(result).toMatchObject({
        type: "nodejs",
        name: "simple-project",
        description: "A simple Node.js project",
        source: "package.json",
      });
    });

    test("should handle project with only pyproject.toml", async () => {
      const mockContext = {
        octokit: {
          repos: {
            getContent: vi.fn(),
          },
        },
        payload: {
          repository: {
            owner: { login: "python-dev" },
            name: "python-project",
          },
        },
      };

      // Mock: pyproject.toml found
      mockContext.octokit.repos.getContent.mockResolvedValueOnce({
        data: {
          content: Buffer.from(
            `
[project]
name = "python-project"
version = "1.0.0"
description = "A Python project"
authors = [{name = "Python Dev", email = "dev@example.com"}]
license = {text = "MIT"}
dependencies = ["requests>=2.25.0"]
keywords = ["python", "utility"]
`
          ).toString("base64"),
        },
      });

      const result = await detectProjectConfig(mockContext);

      expect(result).toMatchObject({
        type: "python",
        name: "python-project",
        description: "A Python project",
        source: "pyproject.toml",
      });
    });

    test("should handle project with no config files", async () => {
      const mockContext = {
        octokit: {
          repos: {
            getContent: vi.fn(),
          },
        },
        payload: {
          repository: {
            owner: { login: "emptyuser" },
            name: "empty-project",
          },
        },
      };

      // Mock: all files not found
      mockContext.octokit.repos.getContent.mockRejectedValue(
        new Error("File not found")
      );

      const result = await detectProjectConfig(mockContext);

      expect(result).toBeNull();
    });
  });

  describe("detectMCPProject Edge Cases", () => {
    test("should identify MCP project by name pattern", () => {
      const mcpNamedProject: ProjectConfig = {
        type: "nodejs",
        name: "mcp-weather-server",
        description: "Weather server",
        version: "1.0.0",
        source: "package.json",
        keywords: [],
        dependencies: [],
      };

      const result = detectMCPProject(mcpNamedProject);
      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("MCP keywords in name");
    });

    test("should identify MCP project by description keywords", () => {
      const mcpDescProject: ProjectConfig = {
        type: "nodejs",
        name: "server",
        description: "A model context protocol server for data access",
        version: "1.0.0",
        source: "package.json",
        keywords: [],
        dependencies: [],
      };

      const result = detectMCPProject(mcpDescProject);
      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("MCP keywords in description");
    });

    test("should identify MCP project by keywords", () => {
      const mcpKeywordProject: ProjectConfig = {
        type: "nodejs",
        name: "server",
        description: "Server application",
        version: "1.0.0",
        source: "package.json",
        keywords: ["mcp", "context-protocol"],
        dependencies: [],
      };

      const result = detectMCPProject(mcpKeywordProject);
      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP-related keywords");
    });

    test("should identify MCP project by dependencies", () => {
      const mcpDepsProject: ProjectConfig = {
        type: "nodejs",
        name: "server",
        description: "Server application",
        version: "1.0.0",
        source: "package.json",
        keywords: [],
        dependencies: ["@modelcontextprotocol/sdk", "fastapi"],
      };

      const result = detectMCPProject(mcpDepsProject);
      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP SDK dependency");
    });

    test("should reject non-MCP projects", () => {
      const regularProject: ProjectConfig = {
        type: "nodejs",
        name: "simple-app",
        description: "A regular application",
        version: "1.0.0",
        source: "package.json",
        keywords: ["web", "app"],
        dependencies: ["express", "lodash"],
      };

      const result = detectMCPProject(regularProject);
      expect(result.isMCPProject).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test("should handle projects with missing fields", () => {
      const minimalProject: ProjectConfig = {
        type: "nodejs",
        name: "minimal",
        version: "1.0.0",
        source: "package.json",
      };

      const result = detectMCPProject(minimalProject);
      expect(result.isMCPProject).toBe(false);
    });

    test("should handle case-insensitive MCP detection", () => {
      const upperCaseProject: ProjectConfig = {
        type: "nodejs",
        name: "MCP-SERVER",
        description: "MODEL CONTEXT PROTOCOL server",
        version: "1.0.0",
        source: "package.json",
        keywords: ["MCP"],
        dependencies: [],
      };

      const result = detectMCPProject(upperCaseProject);
      expect(result.isMCPProject).toBe(true);
    });

    test("should detect MCP files in file paths", () => {
      const project: ProjectConfig = {
        type: "nodejs",
        name: "server",
        description: "Server application",
        version: "1.0.0",
        source: "package.json",
        keywords: [],
        dependencies: [],
      };

      const filePaths = ["src/mcp_server.js", "config/mcp.config.json"];
      const result = detectMCPProject(project, filePaths);

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Has MCP-related files");
    });
  });

  describe("parsePyProjectToml", () => {
    test("should parse valid TOML content", () => {
      const validToml = `
[project]
name = "test-project"
version = "1.0.0"
description = "Test project"
dependencies = ["requests>=2.25.0"]
`;
      const result = parsePyProjectToml(validToml);
      expect(result).toBeTruthy();
      expect(result?.project?.name).toBe("test-project");
    });

    test("should return null for invalid TOML", () => {
      const invalidToml = "{ invalid toml content }";
      const result = parsePyProjectToml(invalidToml);
      expect(result).toBeNull();
    });
  });

  describe("parseSetupPy", () => {
    test("should parse basic setup.py content", () => {
      const setupContent = `
setup(
    name="test-package",
    version="1.0.0",
    description="Test package",
    author="Test Author",
    install_requires=["requests", "pytest"]
)`;
      const result = parseSetupPy(setupContent);
      expect(result).toBeTruthy();
      expect(result?.name).toBe("test-package");
      expect(result?.version).toBe("1.0.0");
    });

    test("should return null for invalid setup.py", () => {
      const invalidSetup = "invalid python content";
      const result = parseSetupPy(invalidSetup);
      expect(result).toBeNull();
    });
  });

  describe("validateProject", () => {
    test("should validate project with valid config", async () => {
      const mockContext = {
        octokit: {
          repos: {
            getContent: vi.fn().mockResolvedValue({
              data: {
                content: Buffer.from(
                  JSON.stringify({
                    name: "valid-project",
                    version: "1.0.0",
                    description: "Valid project",
                  })
                ).toString("base64"),
              },
            }),
          },
        },
        payload: {
          repository: {
            owner: { login: "testuser" },
            name: "valid-project",
          },
        },
      };

      // Mock: pyproject.toml and setup.py not found, package.json found
      mockContext.octokit.repos.getContent
        .mockRejectedValueOnce(new Error("not found"))
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce({
          data: {
            content: Buffer.from(
              JSON.stringify({
                name: "valid-project",
                version: "1.0.0",
                description: "Valid project",
              })
            ).toString("base64"),
          },
        });

      const result = await validateProject(mockContext);
      expect(result.isValid).toBe(true);
    });

    test("should handle validation errors", async () => {
      const mockContext = {
        octokit: {
          repos: {
            getContent: vi.fn().mockRejectedValue(new Error("API error")),
          },
        },
        payload: {
          repository: {
            owner: { login: "testuser" },
            name: "broken-project",
          },
        },
      };

      const result = await validateProject(mockContext);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("No project configuration found");
    });
  });

  describe("validateProjectConfig", () => {
    test("should validate complete project config", () => {
      const validConfig: ProjectConfig = {
        type: "nodejs",
        name: "complete-project",
        version: "1.0.0",
        description: "Complete project description",
        keywords: ["web", "api"],
        dependencies: ["express"],
        source: "package.json",
        packageJson: {
          name: "complete-project",
          version: "1.0.0",
          description: "Complete project description",
        },
      };

      const result = validateProjectConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should identify missing required fields", () => {
      const incompleteConfig: ProjectConfig = {
        type: "nodejs",
        name: "",
        source: "package.json",
      };

      const result = validateProjectConfig(incompleteConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Project name is required");
    });

    test("should handle null config", () => {
      const result = validateProjectConfig(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("No project configuration found");
    });
  });

  describe("getRepositoryFileContent", () => {
    test("should get file content successfully", async () => {
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockResolvedValue({
              data: {
                content: Buffer.from("file content").toString("base64"),
              },
            }),
          },
        },
      };

      const result = await getRepositoryFileContent(
        mockOctokit,
        "owner",
        "repo",
        "README.md"
      );

      expect(result).toBeTruthy();
      expect(result?.content).toBe("file content");
      expect(result?.path).toBe("README.md");
    });

    test("should return null for missing file", async () => {
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockRejectedValue(new Error("Not found")),
          },
        },
      };

      const result = await getRepositoryFileContent(
        mockOctokit,
        "owner",
        "repo",
        "missing.txt"
      );

      expect(result).toBeNull();
    });
  });

  describe("detectMCPFactoryProject", () => {
    test("should detect MCP Factory project with valid structure", async () => {
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn(),
          },
        },
      };

      // Mock pyproject.toml with MCP Factory dependency
      mockOctokit.rest.repos.getContent
        .mockResolvedValueOnce({
          data: {
            content: Buffer.from(
              `
[project]
name = "mcp-factory-server"
version = "1.0.0"  
description = "MCP Factory server"
dependencies = ["mcp-factory>=0.1.0", "pydantic>=2.0.0"]
`
            ).toString("base64"),
          },
        })
        // Mock required files
        .mockResolvedValue({ data: { content: "file content" } });

      const result = await detectMCPFactoryProject(
        mockOctokit as any,
        "owner",
        "repo"
      );

      expect(result.isMCPProject).toBe(true);
      expect(result.reasons).toContain("Found mcp-factory dependency");
    });

    test("should reject project without MCP Factory dependency", async () => {
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockResolvedValue({
              data: {
                content: Buffer.from(
                  `
[project]
name = "regular-project"
dependencies = ["requests>=2.25.0"]
`
                ).toString("base64"),
              },
            }),
          },
        },
      };

      const result = await detectMCPFactoryProject(
        mockOctokit as any,
        "owner",
        "repo"
      );

      expect(result.isMCPProject).toBe(false);
      expect(result.reasons).toContain(
        "Missing mcp-factory dependency in pyproject.toml"
      );
    });

    test("should handle missing pyproject.toml", async () => {
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockRejectedValue(new Error("Not found")),
          },
        },
      };

      const result = await detectMCPFactoryProject(
        mockOctokit as any,
        "owner",
        "repo"
      );

      expect(result.isMCPProject).toBe(false);
      expect(result.reasons).toContain(
        "pyproject.toml not found - not a Python project"
      );
    });
  });

  describe("validateMCPFactoryProject", () => {
    test("should validate complete MCP Factory project", () => {
      const factoryProject: MCPFactoryProject = {
        type: "mcp-factory",
        name: "test-mcp-server",
        version: "1.0.0",
        description: "Test MCP server with all features",
        hasFactoryDependency: true,
        structureCompliance: 1.0,
        keywords: ["mcp", "server"],
        requiredFiles: {
          pyprojectToml: true,
          serverPy: true,
          readme: true,
          configYaml: false,
        },
        requiredDirectories: {
          tools: true,
          resources: true,
          prompts: true,
        },
        pyprojectConfig: {
          project: {
            dependencies: ["mcp-factory>=0.1.0"],
          },
        },
      };

      const result = validateMCPFactoryProject(factoryProject);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should detect missing required fields", () => {
      const incompleteProject: MCPFactoryProject = {
        type: "mcp-factory",
        name: "",
        version: "",
        description: "",
        hasFactoryDependency: false,
        structureCompliance: 0.5,
        requiredFiles: {
          pyprojectToml: false,
          serverPy: false,
          readme: false,
          configYaml: false,
        },
        requiredDirectories: {
          tools: false,
          resources: false,
          prompts: false,
        },
        pyprojectConfig: {
          project: {
            dependencies: [],
          },
        },
      };

      const result = validateMCPFactoryProject(incompleteProject);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain("Project name is required");
      expect(result.errors).toContain(
        "Project must have mcp-factory dependency"
      );
    });
  });

  describe("validateMCPFactoryProjectForRegistration", () => {
    test("should validate project with MCP content", () => {
      const factoryProject: MCPFactoryProject = {
        type: "mcp-factory",
        name: "mcp-weather-server",
        version: "1.0.0",
        description: "Model Context Protocol server for weather data",
        hasFactoryDependency: true,
        structureCompliance: 1.0,
        keywords: ["mcp", "weather", "server"],
        requiredFiles: {
          pyprojectToml: true,
          serverPy: true,
          readme: true,
          configYaml: false,
        },
        requiredDirectories: {
          tools: true,
          resources: true,
          prompts: true,
        },
        pyprojectConfig: {
          project: {
            dependencies: ["mcp-factory>=0.1.0"],
          },
        },
      };

      const result = validateMCPFactoryProjectForRegistration(factoryProject);
      expect(result.isValid).toBe(true);
      expect(result.warnings).not.toContain(
        "Project description should mention MCP or related functionality"
      );
    });

    test("should warn about missing MCP content", () => {
      const factoryProject: MCPFactoryProject = {
        type: "mcp-factory",
        name: "generic-app",
        version: "1.0.0",
        description: "A generic web application",
        hasFactoryDependency: true,
        structureCompliance: 1.0,
        keywords: ["web", "api"],
        requiredFiles: {
          pyprojectToml: true,
          serverPy: true,
          readme: true,
          configYaml: false,
        },
        requiredDirectories: {
          tools: true,
          resources: true,
          prompts: true,
        },
        pyprojectConfig: {
          project: {
            dependencies: ["mcp-factory>=0.1.0"],
          },
        },
      };

      const result = validateMCPFactoryProjectForRegistration(factoryProject);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Project description should mention MCP or related functionality"
      );
    });
  });
});
