import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequest, createResponse } from "node-mocks-http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Mock Redis
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  })),
}));

describe("GitHub OAuth Callback API", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("should reject OPTIONS requests", async () => {
    const { default: callbackHandler } = await import(
      "../../../api/github/callback"
    );

    const mockRequest = createRequest({
      method: "OPTIONS",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await callbackHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });

  test("should reject non-GET methods", async () => {
    const { default: callbackHandler } = await import(
      "../../../api/github/callback"
    );

    const mockRequest = createRequest({
      method: "POST",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await callbackHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });

  test("should handle incomplete callback parameters", async () => {
    const { default: callbackHandler } = await import(
      "../../../api/github/callback"
    );

    const mockRequest = createRequest({
      method: "GET",
      query: {
        // missing required parameters
      },
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await callbackHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Invalid callback parameters");
  });

  test("should handle GitHub App installation callback", async () => {
    const { default: callbackHandler } = await import(
      "../../../api/github/callback"
    );

    const mockRequest = createRequest({
      method: "GET",
      query: {
        setup_action: "install",
        installation_id: "12345678",
        state: JSON.stringify({ redirect_url: "http://localhost:3000" }),
      },
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await callbackHandler(mockRequest, mockResponse);

    // Should process the request successfully
    expect(mockResponse.statusCode).toBe(200);
    expect(mockResponse.getHeader("Content-Type")).toBe("text/html");
  });

  test("should handle error callback", async () => {
    const { default: callbackHandler } = await import(
      "../../../api/github/callback"
    );

    const mockRequest = createRequest({
      method: "GET",
      query: {
        error: "access_denied",
        error_description: "User denied access",
      },
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await callbackHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Invalid callback parameters");
  });

  test("should handle missing environment variables", async () => {
    delete process.env.APP_ID;
    delete process.env.PRIVATE_KEY;

    const { default: callbackHandler } = await import(
      "../../../api/github/callback"
    );

    const mockRequest = createRequest({
      method: "GET",
      query: {
        setup_action: "install",
        installation_id: "12345678",
      },
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await callbackHandler(mockRequest, mockResponse);

    // Should still process but may have warnings about missing configuration
    expect(mockResponse.statusCode).toBe(200);
    expect(mockResponse.getHeader("Content-Type")).toBe("text/html");
  });

  test("should handle invalid state parameter", async () => {
    const { default: callbackHandler } = await import(
      "../../../api/github/callback"
    );

    const mockRequest = createRequest({
      method: "GET",
      query: {
        setup_action: "install",
        installation_id: "12345678",
        state: "invalid-json-state",
      },
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await callbackHandler(mockRequest, mockResponse);

    // Should process even with invalid state (state parsing is not critical)
    expect(mockResponse.statusCode).toBe(200);
    expect(mockResponse.getHeader("Content-Type")).toBe("text/html");
  });
});
