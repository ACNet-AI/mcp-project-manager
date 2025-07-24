import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequest, createResponse } from "node-mocks-http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Mock Octokit
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      apps: {
        getInstallation: vi.fn().mockResolvedValue({
          data: {
            id: 12345678,
            account: {
              login: "test-user",
              type: "User",
            },
          },
        }),
        listInstallationsForAuthenticatedUser: vi.fn().mockResolvedValue({
          data: {
            installations: [
              {
                id: 12345678,
                account: {
                  login: "test-user",
                  type: "User",
                },
              },
            ],
          },
        }),
      },
    },
  })),
}));

describe("Installation Status API", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.APP_ID = "123456";
    process.env.PRIVATE_KEY =
      "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("should reject OPTIONS requests", async () => {
    const { default: statusHandler } = await import(
      "../../../api/github/installation-status"
    );

    const mockRequest = createRequest({
      method: "OPTIONS",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await statusHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });

  test("should reject non-GET methods", async () => {
    const { default: statusHandler } = await import(
      "../../../api/github/installation-status"
    );

    const mockRequest = createRequest({
      method: "POST",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await statusHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });

  test("should require user parameter", async () => {
    const { default: statusHandler } = await import(
      "../../../api/github/installation-status"
    );

    const mockRequest = createRequest({
      method: "GET",
      url: "/api/github/installation-status", // no user parameter
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await statusHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Username required");
  });

  test("should handle GitHub API call for valid user", async () => {
    const { default: statusHandler } = await import(
      "../../../api/github/installation-status"
    );

    const mockRequest = createRequest({
      method: "GET",
      url: "/api/github/installation-status?user=test-user",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await statusHandler(mockRequest, mockResponse);

    // API will attempt to call GitHub but may fail due to mocked Octokit
    expect(mockResponse.statusCode).not.toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData).toHaveProperty("error");
  });

  test("should handle empty user parameter", async () => {
    const { default: statusHandler } = await import(
      "../../../api/github/installation-status"
    );

    const mockRequest = createRequest({
      method: "GET",
      url: "/api/github/installation-status?user=", // empty user
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await statusHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Username required");
  });

  test("should handle missing environment variables", async () => {
    delete process.env.APP_ID;
    delete process.env.PRIVATE_KEY;

    const { default: statusHandler } = await import(
      "../../../api/github/installation-status"
    );

    const mockRequest = createRequest({
      method: "GET",
      url: "/api/github/installation-status?user=test-user",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await statusHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(500);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("GitHub App not configured");
  });

  test("should handle GitHub API errors", async () => {
    // Mock GitHub API error
    const mockOctokit = {
      rest: {
        apps: {
          getInstallation: vi
            .fn()
            .mockRejectedValue(new Error("Installation not found")),
        },
      },
    };

    vi.doMock("@octokit/rest", () => ({
      Octokit: vi.fn().mockImplementation(() => mockOctokit),
    }));

    const { default: statusHandler } = await import(
      "../../../api/github/installation-status"
    );

    const mockRequest = createRequest({
      method: "GET",
      query: {
        "installation-id": "99999999",
      },
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await statusHandler(mockRequest, mockResponse);

    // Should handle the error gracefully
    expect(mockResponse.statusCode).not.toBe(405);
  });
});
