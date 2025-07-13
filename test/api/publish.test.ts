import { describe, test, expect, beforeEach, vi } from "vitest";
import { createRequest, createResponse } from "node-mocks-http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import publishHandler from "../../api/publish.js";

// Mock the dependencies
vi.mock("../../src/utils/registry", () => ({
  extractProjectInfo: vi.fn(),
  validateRegistrationData: vi.fn(),
}));

vi.mock("../../src/utils/validation", () => ({
  parsePyProjectToml: vi.fn(),
  validateMCPFactoryProject: vi.fn(),
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
  });

  test("should handle valid publish request", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      query: {},
      cookies: {},
      body: {
        projectName: "test-mcp-server",
        description: "A test MCP server",
        version: "1.0.0",
        language: "typescript",
        files: [
          {
            path: "package.json",
            content: JSON.stringify({
              name: "test-mcp-server",
              description: "A test MCP server",
              dependencies: {
                "@modelcontextprotocol/sdk": "^1.0.0",
              },
            }),
          },
          {
            path: "README.md",
            content: "# Test MCP Server",
          },
        ],
      },
    } as VercelRequest;

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
    expect(responseData.repository).toBe(
      "https://github.com/unknown/test-mcp-server"
    );
    expect(responseData.message).toBe("Typescript project prepared for publishing");
  });

  test("should handle valid Python MCP Factory project", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      query: {},
      cookies: {},
      body: {
        projectName: "test-mcp-factory",
        description: "A test MCP Factory server",
        version: "1.0.0",
        language: "python",
        files: [
          {
            path: "pyproject.toml",
            content: `[project]
name = "test-mcp-factory"
description = "A test MCP Factory server"
version = "1.0.0"
dependencies = ["mcp-factory"]`,
          },
          {
            path: "server.py",
            content: "# MCP Factory server",
          },
          {
            path: "README.md",
            content: "# Test MCP Factory Server",
          },
        ],
      },
    } as VercelRequest;

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
    expect(responseData.language).toBe("python");
    expect(responseData.message).toBe("Python project prepared for publishing");
    expect(responseData.projectInfo.type).toBe("mcp-factory");
  });

  test("should reject Python project without pyproject.toml", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      query: {},
      cookies: {},
      body: {
        projectName: "test-python-server",
        description: "A test Python server",
        version: "1.0.0",
        language: "python",
        files: [
          {
            path: "server.py",
            content: "# Python server",
          },
          {
            path: "README.md",
            content: "# Test Python Server",
          },
        ],
      },
    } as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("No valid pyproject.toml found for Python project");
  });

  test("should reject unsupported language", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      query: {},
      cookies: {},
      body: {
        projectName: "test-server",
        description: "A test server",
        version: "1.0.0",
        language: "java",
        files: [
          {
            path: "pom.xml",
            content: "<project></project>",
          },
        ],
      },
    } as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toContain("Unsupported project language: java");
  });

  test("should reject invalid request", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      query: {},
      cookies: {},
      body: {
        // Missing required fields
        description: "A test server",
      },
    } as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toContain("Missing required fields");
  });

  test("should reject project with invalid registration data", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      query: {},
      cookies: {},
      body: {
        projectName: "test-server",
        description: "A test server",
        version: "1.0.0",
        language: "typescript",
        files: [
          {
            path: "package.json",
            content: JSON.stringify({
              name: "test-server",
              description: "A test server",
            }),
          },
        ],
      },
    } as VercelRequest;

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

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Invalid Node.js project data");
    expect(responseData.details).toEqual(["Project description is required"]);
  });

  test("should handle missing package.json", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      query: {},
      cookies: {},
      body: {
        projectName: "test-server",
        description: "A test server",
        version: "1.0.0",
        language: "typescript",
        files: [
          {
            path: "README.md",
            content: "# Test Server",
          },
        ],
      },
    } as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("No valid package.json found for Node.js project");
  });

  test("should handle invalid JSON in package.json", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      query: {},
      cookies: {},
      body: {
        projectName: "test-server",
        description: "A test server",
        version: "1.0.0",
        language: "typescript",
        files: [
          {
            path: "package.json",
            content: "{ invalid json }",
          },
        ],
      },
    } as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Invalid package.json format");
  });

  test("should handle internal server errors", async () => {
    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      query: {},
      cookies: {},
      body: {
        projectName: "test-server",
        description: "A test server",
        version: "1.0.0",
        language: "typescript",
        files: [
          {
            path: "package.json",
            content: JSON.stringify({
              name: "test-server",
              description: "A test server",
            }),
          },
        ],
      },
    } as VercelRequest;

    const mockResponse = createResponse() as any;

    // Mock project info extraction to throw error
    (extractProjectInfo as any).mockImplementation(() => {
      throw new Error("Internal processing error");
    });

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(500);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Internal server error");
    expect(responseData.message).toBe("Internal processing error");
  });

  test("should only accept POST method", async () => {
    const mockRequest = {
      method: "GET",
      headers: {},
      query: {},
      cookies: {},
      body: {},
    } as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });
});
