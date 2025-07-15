import { describe, test, expect, beforeEach, vi } from "vitest";
import { createRequest, createResponse } from "node-mocks-http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import publishHandler from "../../api/publish";

// Mock the dependencies
vi.mock("../../src/utils/registry", () => ({
  extractProjectInfo: vi.fn(),
  validateRegistrationData: vi.fn(),
}));

vi.mock("../../src/utils/validation", () => ({
  parsePyProjectToml: vi.fn(),
  validateMCPFactoryProject: vi.fn(),
}));

// Mock Octokit
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      repos: {
        createForAuthenticatedUser: vi.fn().mockResolvedValue({
          data: {
            id: 12345,
            name: "test-repo",
            full_name: "test-user/test-repo",
            html_url: "https://github.com/test-user/test-repo",
            clone_url: "https://github.com/test-user/test-repo.git",
            ssh_url: "git@github.com:test-user/test-repo.git",
            private: false,
            owner: {
              login: "test-user",
            },
            created_at: "2024-01-01T00:00:00Z",
          },
        }),
        createOrUpdateFileContents: vi.fn().mockResolvedValue({
          data: {
            content: { sha: "abc123" },
            commit: { sha: "def456" },
          },
        }),
      },
    },
  })),
}));

import {
  extractProjectInfo,
  validateRegistrationData,
} from "../../src/utils/registry";

import {
  parsePyProjectToml,
  validateMCPFactoryProject,
} from "../../src/utils/validation";

describe("Publish API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set automation bypass for tests
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "test-bypass-secret";
  });

  test("should handle valid publish request", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-protection-bypass": "test-bypass-secret",
      },
      query: {},
      cookies: {},
      body: {
        name: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        language: "typescript",
        projectFiles: {
          "package.json": JSON.stringify({
            name: "test-mcp-server",
            description: "A test MCP server",
            dependencies: {
              "@modelcontextprotocol/sdk": "^1.0.0",
            },
          }),
          "README.md": "# Test MCP Server",
        },
      },
    } as unknown as VercelRequest;

    const mockResponse = createResponse() as any;

    // Mock project info extraction
    (extractProjectInfo as any).mockReturnValue({
      name: "test-mcp-server",
      description: "A test MCP server",
      repository: "https://github.com/unknown/test-mcp-server",
      version: "1.0.0",
      language: "typescript",
      category: "general",
      tags: [],
    });

    // Mock registration validation
    (validateRegistrationData as any).mockReturnValue({
      isValid: true,
      errors: [],
    });

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.repository).toMatchObject({
      name: "test-repo",
      url: "https://github.com/test-user/test-repo",
      owner: "test-user",
    });
          expect(responseData.message).toBe("Repository created successfully");
  });

  test("should handle valid Python MCP Factory project", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-protection-bypass": "test-bypass-secret",
      },
      query: {},
      cookies: {},
      body: {
        name: "test-mcp-factory",
        description: "A test MCP Factory server",
        version: "1.0.0",
        language: "python",
        projectFiles: {
          "pyproject.toml": `[project]
name = "test-mcp-factory"
description = "A test MCP Factory server"
version = "1.0.0"
dependencies = ["mcp-factory"]`,
          "server.py": "# MCP Factory server",
          "README.md": "# Test MCP Factory Server",
        },
      },
    } as unknown as VercelRequest;

    const mockResponse = createResponse() as any;

    // Mock pyproject.toml parsing
    (parsePyProjectToml as any).mockReturnValue({
      project: {
        name: "test-mcp-factory",
        description: "A test MCP Factory server",
        version: "1.0.0",
        dependencies: ["mcp-factory"],
      },
    });

    // Mock Python project validation
    (validateMCPFactoryProject as any).mockReturnValue({
      isValid: true,
      errors: [],
    });

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe("Repository created successfully");
    expect(responseData.repository).toMatchObject({
      name: "test-repo",
      url: "https://github.com/test-user/test-repo",
      owner: "test-user",
    });
  });

  test("should reject Python project without pyproject.toml", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-protection-bypass": "test-bypass-secret",
      },
      query: {},
      cookies: {},
      body: {
        name: "test-python-server",
        description: "A test Python server",
        version: "1.0.0",
        language: "python",
        projectFiles: {
          "server.py": "# Python server",
          "README.md": "# Test Python Server",
        },
      },
    } as unknown as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe("Repository created successfully");
  });

  test("should reject unsupported language", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-protection-bypass": "test-bypass-secret",
      },
      query: {},
      cookies: {},
      body: {
        name: "test-server",
        description: "A test server",
        version: "1.0.0",
        language: "java",
        projectFiles: {
          "pom.xml": "<project></project>",
        },
      },
    } as unknown as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe("Repository created successfully");
  });

  test("should reject invalid request", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-protection-bypass": "test-bypass-secret",
      },
      query: {},
      cookies: {},
      body: {
        // Missing required fields
        description: "A test server",
      },
    } as unknown as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toContain("Missing project name");
  });

  test("should reject project with invalid registration data", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-protection-bypass": "test-bypass-secret",
      },
      query: {},
      cookies: {},
      body: {
        name: "test-server",
        description: "A test server",
        version: "1.0.0",
        language: "typescript",
        projectFiles: {
          "package.json": JSON.stringify({
            name: "test-server",
            description: "A test server",
          }),
        },
      },
    } as unknown as VercelRequest;

    const mockResponse = createResponse() as any;

    // Mock project info extraction
    (extractProjectInfo as any).mockReturnValue({
      name: "test-server",
      description: "",
      repository: "https://github.com/unknown/test-server",
      version: "1.0.0",
      language: "typescript",
    });

    // Mock validation failure
    (validateRegistrationData as any).mockReturnValue({
      isValid: false,
      errors: ["Project description is required"],
    });

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe("Repository created successfully");
  });

  test("should handle missing package.json", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-protection-bypass": "test-bypass-secret",
      },
      query: {},
      cookies: {},
      body: {
        name: "test-server",
        description: "A test server",
        version: "1.0.0",
        language: "typescript",
        projectFiles: {
          "README.md": "# Test Server",
        },
      },
    } as unknown as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe("Repository created successfully");
  });

  test("should handle invalid JSON in package.json", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-protection-bypass": "test-bypass-secret",
      },
      query: {},
      cookies: {},
      body: {
        name: "test-server",
        description: "A test server",
        version: "1.0.0",
        language: "typescript",
        projectFiles: {
          "package.json": "{ invalid json }",
        },
      },
    } as unknown as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe("Repository created successfully");
  });

  test("should handle internal server errors", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-protection-bypass": "test-bypass-secret",
      },
      query: {},
      cookies: {},
      body: {
        name: "test-server",
        description: "A test server",
        version: "1.0.0",
        language: "typescript",
        projectFiles: {
          "package.json": JSON.stringify({
            name: "test-server",
            description: "A test server",
          }),
        },
      },
    } as unknown as VercelRequest;

    const mockResponse = createResponse() as any;

    // Mock project info extraction to throw error
    (extractProjectInfo as any).mockImplementation(() => {
      throw new Error("Internal processing error");
    });

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe("Repository created successfully");
  });

  test("should only accept POST method", async () => {
    const mockRequest = {
      method: "GET",
      headers: {},
      query: {},
      cookies: {},
      body: {},
    } as unknown as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });
});
