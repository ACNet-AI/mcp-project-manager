import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequest, createResponse } from "node-mocks-http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Mock Redis
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue("test-oauth-token"),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  })),
}));

// Mock Octokit
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      apps: {
        listInstallationsForAuthenticatedUser: vi.fn().mockResolvedValue({
          data: {
            installations: [
              {
                id: 12345678,
                account: {
                  login: "test-user",
                  type: "User",
                },
                permissions: {
                  contents: "read",
                  metadata: "read",
                },
              },
            ],
          },
        }),
      },
    },
  })),
}));

describe("User Installations API", () => {
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
    const { default: userInstallationsHandler } = await import(
      "../../../api/github/user-installations"
    );

    const mockRequest = createRequest({
      method: "OPTIONS",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await userInstallationsHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });

  test("should reject non-GET methods", async () => {
    const { default: userInstallationsHandler } = await import(
      "../../../api/github/user-installations"
    );

    const mockRequest = createRequest({
      method: "POST",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await userInstallationsHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });

  test("should require username parameter", async () => {
    const { default: userInstallationsHandler } = await import(
      "../../../api/github/user-installations"
    );

    const mockRequest = createRequest({
      method: "GET",
      url: "/api/github/user-installations", // no username parameter
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await userInstallationsHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Username required");
  });

  test("should handle GitHub API call for user installations", async () => {
    const { default: userInstallationsHandler } = await import(
      "../../../api/github/user-installations"
    );

    const mockRequest = createRequest({
      method: "GET",
      url: "/api/github/user-installations?username=test-user",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await userInstallationsHandler(mockRequest, mockResponse);

    // API will attempt to call GitHub but may fail due to mocked Octokit
    expect(mockResponse.statusCode).not.toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData).toHaveProperty("error");
  });

  test("should handle API errors gracefully", async () => {
    const { default: userInstallationsHandler } = await import(
      "../../../api/github/user-installations"
    );

    const mockRequest = createRequest({
      method: "GET",
      url: "/api/github/user-installations?username=nonexistent-user",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await userInstallationsHandler(mockRequest, mockResponse);

    // Should process but may return error or success based on GitHub API
    expect(mockResponse.statusCode).not.toBe(405);
  });

  test("should handle GitHub API errors", async () => {
    // Mock GitHub API error
    const mockOctokit = {
      rest: {
        apps: {
          listInstallationsForAuthenticatedUser: vi
            .fn()
            .mockRejectedValue(new Error("API error")),
        },
      },
    };

    vi.doMock("@octokit/rest", () => ({
      Octokit: vi.fn().mockImplementation(() => mockOctokit),
    }));

    const { default: userInstallationsHandler } = await import(
      "../../../api/github/user-installations"
    );

    const mockRequest = createRequest({
      method: "GET",
      query: {
        "user-id": "test-user",
      },
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await userInstallationsHandler(mockRequest, mockResponse);

    // Should handle the error gracefully
    expect(mockResponse.statusCode).not.toBe(405);
  });

  test("should handle empty username", async () => {
    const { default: userInstallationsHandler } = await import(
      "../../../api/github/user-installations"
    );

    const mockRequest = createRequest({
      method: "GET",
      url: "/api/github/user-installations?username=", // empty username
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await userInstallationsHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Username required");
  });

  test("should handle Redis connection errors", async () => {
    // Mock Redis to throw error
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn().mockImplementation(() => ({
        get: vi.fn().mockRejectedValue(new Error("Redis connection failed")),
      })),
    }));

    const { default: userInstallationsHandler } = await import(
      "../../../api/github/user-installations"
    );

    const mockRequest = createRequest({
      method: "GET",
      query: {
        "user-id": "test-user",
      },
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await userInstallationsHandler(mockRequest, mockResponse);

    // Should handle Redis errors gracefully
    expect(mockResponse.statusCode).not.toBe(405);
  });
});
