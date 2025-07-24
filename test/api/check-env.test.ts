import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createRequest, createResponse } from "node-mocks-http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import checkEnvHandler from "../../api/check-env";

describe("Check Environment API", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Create a fresh copy of process.env for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  test("should return environment status with all required variables", async () => {
    // Set required environment variables
    process.env.APP_ID = "123456";
    process.env.PRIVATE_KEY =
      "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
    process.env.NODE_ENV = "test";

    const mockRequest = createRequest({
      method: "GET",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await checkEnvHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData).toMatchObject({
      environment: "test",
      timestamp: expect.any(String),
      config_status: {
        APP_ID: {
          present: true,
          length: expect.any(Number),
        },
        PRIVATE_KEY: {
          present: true,
          length: expect.any(Number),
        },
        GITHUB_CLIENT_ID: {
          present: true,
          length: expect.any(Number),
        },
        GITHUB_CLIENT_SECRET: {
          present: true,
          length: expect.any(Number),
        },
      },
      oauth_support: {
        enabled: true,
        status: "OAuth tokens can be obtained",
      },
      message: "Environment check completed",
    });
  });

  test("should detect missing environment variables", async () => {
    // Remove environment variables
    delete process.env.APP_ID;
    delete process.env.PRIVATE_KEY;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    const mockRequest = createRequest({
      method: "GET",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await checkEnvHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.config_status.APP_ID.present).toBe(false);
    expect(responseData.config_status.PRIVATE_KEY.present).toBe(false);
    expect(responseData.config_status.GITHUB_CLIENT_ID.present).toBe(false);
    expect(responseData.config_status.GITHUB_CLIENT_SECRET.present).toBe(false);
    expect(responseData.oauth_support.enabled).toBe(false);
    expect(responseData.oauth_support.status).toBe("OAuth setup incomplete");
  });

  test("should reject non-GET methods", async () => {
    const mockRequest = createRequest({
      method: "POST",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await checkEnvHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });
});
