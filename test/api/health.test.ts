import { describe, test, expect } from "vitest";
import { createRequest, createResponse } from "node-mocks-http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import healthHandler from "../../api/health";

describe("Health API", () => {
  test("should return health status", async () => {
    const mockRequest = createRequest({
      method: "GET",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await healthHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData).toMatchObject({
      status: "healthy",
      service: "mcp-project-manager",
      timestamp: expect.any(String),
      uptime: expect.any(Number),
      environment: expect.any(String),
      version: "1.0.0",
      checks: {
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          unit: "MB",
        },
      },
    });
  });

  test("should reject non-GET methods", async () => {
    const mockRequest = createRequest({
      method: "POST",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await healthHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData).toMatchObject({
      status: "error",
      error: "Method not allowed",
    });
  });
});
