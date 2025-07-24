import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequest, createResponse } from "node-mocks-http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

describe("GitHub App Install API", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("should reject OPTIONS requests", async () => {
    const { default: installHandler } = await import(
      "../../../api/github/install"
    );

    const mockRequest = createRequest({
      method: "OPTIONS",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await installHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });

  test("should reject non-GET methods", async () => {
    const { default: installHandler } = await import(
      "../../../api/github/install"
    );

    const mockRequest = createRequest({
      method: "POST",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await installHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });

  test("should return GitHub App installation URL", async () => {
    const { default: installHandler } = await import(
      "../../../api/github/install"
    );

    const mockRequest = createRequest({
      method: "GET",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await installHandler(mockRequest, mockResponse);

    // Should return installation URL in JSON response
    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.install_url).toContain("github.com/apps/");
    expect(responseData.install_url).toContain("/installations/new");
    expect(responseData.request_id).toBeDefined();
  });

  test("should handle custom project name", async () => {
    const { default: installHandler } = await import(
      "../../../api/github/install"
    );

    const mockRequest = createRequest({
      method: "GET",
      query: {
        project_name: "my-custom-project",
      },
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await installHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.install_url).toContain("state=");
  });

  test("should work even without environment variables", async () => {
    delete process.env.GITHUB_CLIENT_ID;

    const { default: installHandler } = await import(
      "../../../api/github/install"
    );

    const mockRequest = createRequest({
      method: "GET",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await installHandler(mockRequest, mockResponse);

    // Install API doesn't need environment variables to generate the URL
    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.success).toBe(true);
    expect(responseData.install_url).toContain("github.com/apps/");
  });

  test("should generate state parameter and request ID", async () => {
    const { default: installHandler } = await import(
      "../../../api/github/install"
    );

    const mockRequest = createRequest({
      method: "GET",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await installHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.install_url).toContain("state=");
    expect(responseData.request_id).toMatch(/^req_\d+_[a-z0-9]+$/);
  });
});
