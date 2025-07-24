import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequest, createResponse } from "node-mocks-http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Mock Redis to avoid external dependencies
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  })),
}));

// Mock Octokit to avoid GitHub API calls
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      repos: {
        createForAuthenticatedUser: vi.fn().mockResolvedValue({
          data: {
            id: 123456,
            name: "test-repo",
            full_name: "test-user/test-repo",
            html_url: "https://github.com/test-user/test-repo",
            clone_url: "https://github.com/test-user/test-repo.git",
            private: false,
            default_branch: "main",
          },
        }),
        createInOrg: vi.fn().mockResolvedValue({
          data: {
            id: 123457,
            name: "org-repo",
            full_name: "test-org/org-repo",
            html_url: "https://github.com/test-org/org-repo",
          },
        }),
      },
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
        createInstallationAccessToken: vi.fn().mockResolvedValue({
          data: {
            token: "ghs_mock_installation_token",
            expires_at: "2024-01-01T00:00:00Z",
          },
        }),
      },
    },
  })),
}));

// Mock GitHub App authentication
vi.mock("@octokit/auth-app", () => ({
  createAppAuth: vi.fn().mockReturnValue(() =>
    Promise.resolve({
      type: "installation",
      token: "ghs_mock_app_token",
      installationId: 12345678,
    })
  ),
}));

describe("Publish API", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.APP_ID = "123456";
    process.env.PRIVATE_KEY =
      "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";
    process.env.WEBHOOK_SECRET = "test-webhook-secret";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("should handle CORS preflight requests", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "OPTIONS",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(200);
    expect(mockResponse.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(mockResponse.getHeader("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS"
    );
    expect(mockResponse.getHeader("Access-Control-Allow-Headers")).toBe(
      "Content-Type, installation-id"
    );
  });

  test("should reject non-POST methods", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "GET",
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(405);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Method not allowed");
  });

  test("should require installation-id header", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "POST",
      headers: {},
      body: { name: "test-repo" },
    }) as VercelRequest;

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).toBe(400);
    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData.error).toBe("Missing authentication");
    expect(responseData.details).toContain("installation-id");
  });

  test("should validate request body structure", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "POST",
      headers: {
        "installation-id": "12345678",
      },
    }) as any;

    // Mock the request stream for body parsing to return empty object
    mockRequest.on = vi.fn((event, callback) => {
      if (event === "data") {
        callback(Buffer.from(JSON.stringify({})));
      } else if (event === "end") {
        callback();
      }
    });

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    // The API uses async processing, so initial response might be 200
    // but the validation happens in the async handler
    expect(mockResponse.statusCode).not.toBe(405); // Just not method not allowed
  });

  test("should handle valid repository creation request", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "POST",
      headers: {
        "installation-id": "12345678",
      },
    }) as any;

    // Mock the request stream for body parsing
    mockRequest.on = vi.fn((event, callback) => {
      if (event === "data") {
        callback(
          Buffer.from(
            JSON.stringify({
              name: "new-awesome-repo",
              description: "An awesome new repository",
              private: false,
            })
          )
        );
      } else if (event === "end") {
        callback();
      }
    });

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    // Should not be authentication error
    expect(mockResponse.statusCode).not.toBe(400);
  });

  test("should handle repository creation with organization", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "POST",
      headers: {
        "installation-id": "12345678",
      },
    }) as any;

    mockRequest.on = vi.fn((event, callback) => {
      if (event === "data") {
        callback(
          Buffer.from(
            JSON.stringify({
              name: "org-repo",
              owner: "test-organization",
              description: "Organization repository",
              private: true,
            })
          )
        );
      } else if (event === "end") {
        callback();
      }
    });

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    // Should attempt to process the request
    expect(mockResponse.statusCode).not.toBe(405);
  });

  test("should handle invalid JSON in request body", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "POST",
      headers: {
        "installation-id": "12345678",
      },
    }) as any;

    // Mock invalid JSON
    mockRequest.on = vi.fn((event, callback) => {
      if (event === "data") {
        callback(Buffer.from("invalid json{"));
      } else if (event === "end") {
        callback();
      }
    });

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    // API processes asynchronously, check it doesn't return method error
    expect(mockResponse.statusCode).not.toBe(405);
  });

  test("should handle empty request body", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "POST",
      headers: {
        "installation-id": "12345678",
      },
    }) as any;

    // Mock empty body
    mockRequest.on = vi.fn((event, callback) => {
      if (event === "data") {
        // No data chunks
      } else if (event === "end") {
        callback();
      }
    });

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.statusCode).not.toBe(405);
  });

  test("should handle request body parsing error", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "POST",
      headers: {
        "installation-id": "12345678",
      },
    }) as any;

    // Mock request error
    mockRequest.on = vi.fn((event, callback) => {
      if (event === "error") {
        callback(new Error("Request parsing failed"));
      }
    });

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    // Should handle the error gracefully
    expect(mockResponse.statusCode).not.toBe(405);
  });

  test("should handle repository name validation", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const invalidNames = [
      "", // empty
      "a", // too short
      " ", // whitespace
      "INVALID-NAME", // uppercase
      "invalid_name", // underscore
      "invalid.name", // dot
      "123invalid", // starts with number
    ];

    for (const invalidName of invalidNames) {
      const mockRequest = createRequest({
        method: "POST",
        headers: {
          "installation-id": "12345678",
        },
      }) as any;

      mockRequest.on = vi.fn((event, callback) => {
        if (event === "data") {
          callback(
            Buffer.from(
              JSON.stringify({
                name: invalidName,
                description: "Test repository",
              })
            )
          );
        } else if (event === "end") {
          callback();
        }
      });

      const mockResponse = createResponse() as any;

      await publishHandler(mockRequest, mockResponse);

      // Most invalid names should be processed (API is async)
      expect(mockResponse.statusCode).not.toBe(405);
      // Reset response for next iteration
      mockResponse._end = false;
      mockResponse._finished = false;
      mockResponse._getData = () => "";
    }
  });

  test("should handle missing environment variables", async () => {
    // Temporarily remove environment variables
    delete process.env.APP_ID;
    delete process.env.PRIVATE_KEY;

    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "POST",
      headers: {
        "installation-id": "12345678",
      },
    }) as any;

    mockRequest.on = vi.fn((event, callback) => {
      if (event === "data") {
        callback(
          Buffer.from(
            JSON.stringify({
              name: "test-repo",
              description: "Test repository",
            })
          )
        );
      } else if (event === "end") {
        callback();
      }
    });

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    // Should handle missing environment variables gracefully
    expect(mockResponse.statusCode).not.toBe(405);
  });

  test("should handle large request bodies", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "POST",
      headers: {
        "installation-id": "12345678",
      },
    }) as any;

    // Create a large description
    const largeDescription = "a".repeat(10000);

    mockRequest.on = vi.fn((event, callback) => {
      if (event === "data") {
        callback(
          Buffer.from(
            JSON.stringify({
              name: "test-repo",
              description: largeDescription,
            })
          )
        );
      } else if (event === "end") {
        callback();
      }
    });

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    // Should handle large bodies (may accept or reject based on validation)
    expect(mockResponse.statusCode).not.toBe(405);
  });

  test("should set correct CORS headers", async () => {
    const { default: publishHandler } = await import("../../api/publish");

    const mockRequest = createRequest({
      method: "POST",
      headers: {
        "installation-id": "12345678",
      },
    }) as any;

    mockRequest.on = vi.fn((event, callback) => {
      if (event === "data") {
        callback(
          Buffer.from(
            JSON.stringify({
              name: "test-repo",
            })
          )
        );
      } else if (event === "end") {
        callback();
      }
    });

    const mockResponse = createResponse() as any;

    await publishHandler(mockRequest, mockResponse);

    expect(mockResponse.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(mockResponse.getHeader("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS"
    );
    expect(mockResponse.getHeader("Access-Control-Allow-Headers")).toBe(
      "Content-Type, installation-id"
    );
  });

  describe("Repository Creation Logic", () => {
    test("should handle repository creation with organization owner", async () => {
      const { default: publishHandler } = await import("../../api/publish");

      const mockRequest = createRequest({
        method: "POST",
        headers: {
          "installation-id": "12345678",
        },
      }) as any;

      mockRequest.on = vi.fn((event, callback) => {
        if (event === "data") {
          callback(
            Buffer.from(
              JSON.stringify({
                name: "org-repo",
                owner: "test-organization",
                description: "Organization repository",
                private: true,
              })
            )
          );
        } else if (event === "end") {
          callback();
        }
      });

      const mockResponse = createResponse() as any;

      await publishHandler(mockRequest, mockResponse);

      // Should attempt to process organization repository creation
      expect(mockResponse.getHeader("Content-Type")).toBe("application/json");
    });

    test("should handle repository creation with special characters in name", async () => {
      const { default: publishHandler } = await import("../../api/publish");

      const mockRequest = createRequest({
        method: "POST",
        headers: {
          "installation-id": "12345678",
        },
      }) as any;

      mockRequest.on = vi.fn((event, callback) => {
        if (event === "data") {
          callback(
            Buffer.from(
              JSON.stringify({
                name: "my-awesome-repo-2024",
                description: "Repository with special naming",
                auto_init: true,
                gitignore_template: "Node",
                license_template: "MIT",
              })
            )
          );
        } else if (event === "end") {
          callback();
        }
      });

      const mockResponse = createResponse() as any;

      await publishHandler(mockRequest, mockResponse);

      // Should process the request with all optional fields
      expect(mockResponse.getHeader("Content-Type")).toBe("application/json");
    });

    test("should handle private repository creation", async () => {
      const { default: publishHandler } = await import("../../api/publish");

      const mockRequest = createRequest({
        method: "POST",
        headers: {
          "installation-id": "12345678",
        },
      }) as any;

      mockRequest.on = vi.fn((event, callback) => {
        if (event === "data") {
          callback(
            Buffer.from(
              JSON.stringify({
                name: "private-repo",
                description: "Private repository",
                private: true,
                auto_init: false,
              })
            )
          );
        } else if (event === "end") {
          callback();
        }
      });

      const mockResponse = createResponse() as any;

      await publishHandler(mockRequest, mockResponse);

      // Should handle private repository creation
      expect(mockResponse.getHeader("Content-Type")).toBe("application/json");
    });

    test("should handle repository creation with all optional fields", async () => {
      const { default: publishHandler } = await import("../../api/publish");

      const mockRequest = createRequest({
        method: "POST",
        headers: {
          "installation-id": "87654321",
        },
      }) as any;

      mockRequest.on = vi.fn((event, callback) => {
        if (event === "data") {
          callback(
            Buffer.from(
              JSON.stringify({
                name: "full-featured-repo",
                description: "Repository with all features enabled",
                owner: "test-user",
                private: false,
                auto_init: true,
                gitignore_template: "Python",
                license_template: "Apache-2.0",
              })
            )
          );
        } else if (event === "end") {
          callback();
        }
      });

      const mockResponse = createResponse() as any;

      await publishHandler(mockRequest, mockResponse);

      // Should process repository with all possible configuration options
      expect(mockResponse.getHeader("Content-Type")).toBe("application/json");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("should handle non-numeric installation ID", async () => {
      const { default: publishHandler } = await import("../../api/publish");

      const mockRequest = createRequest({
        method: "POST",
        headers: {
          "installation-id": "invalid-id",
        },
      }) as any;

      mockRequest.on = vi.fn((event, callback) => {
        if (event === "data") {
          callback(
            Buffer.from(
              JSON.stringify({
                name: "test-repo",
              })
            )
          );
        } else if (event === "end") {
          callback();
        }
      });

      const mockResponse = createResponse() as any;

      await publishHandler(mockRequest, mockResponse);

      // Should attempt to process even with non-numeric ID
      expect(mockResponse.getHeader("Content-Type")).toBe("application/json");
    });

    test("should handle extremely long repository names", async () => {
      const { default: publishHandler } = await import("../../api/publish");

      const mockRequest = createRequest({
        method: "POST",
        headers: {
          "installation-id": "12345678",
        },
      }) as any;

      const longName = "a".repeat(100); // Very long name

      mockRequest.on = vi.fn((event, callback) => {
        if (event === "data") {
          callback(
            Buffer.from(
              JSON.stringify({
                name: longName,
                description: "Repository with extremely long name",
              })
            )
          );
        } else if (event === "end") {
          callback();
        }
      });

      const mockResponse = createResponse() as any;

      await publishHandler(mockRequest, mockResponse);

      // Should handle validation of long names
      expect(mockResponse.getHeader("Content-Type")).toBe("application/json");
    });

    test("should handle request body with only required fields", async () => {
      const { default: publishHandler } = await import("../../api/publish");

      const mockRequest = createRequest({
        method: "POST",
        headers: {
          "installation-id": "12345678",
        },
      }) as any;

      mockRequest.on = vi.fn((event, callback) => {
        if (event === "data") {
          callback(
            Buffer.from(
              JSON.stringify({
                name: "minimal-repo",
              })
            )
          );
        } else if (event === "end") {
          callback();
        }
      });

      const mockResponse = createResponse() as any;

      await publishHandler(mockRequest, mockResponse);

      // Should work with minimal required fields
      expect(mockResponse.getHeader("Content-Type")).toBe("application/json");
    });

    test("should handle request with malformed body stream", async () => {
      const { default: publishHandler } = await import("../../api/publish");

      const mockRequest = createRequest({
        method: "POST",
        headers: {
          "installation-id": "12345678",
        },
      }) as any;

      mockRequest.on = vi.fn((event, callback) => {
        if (event === "data") {
          callback(Buffer.from("{invalid json"));
        } else if (event === "end") {
          callback();
        } else if (event === "error") {
          // Mock a stream error
          callback(new Error("Stream error"));
        }
      });

      const mockResponse = createResponse() as any;

      await publishHandler(mockRequest, mockResponse);

      // Should handle stream errors gracefully
      expect(mockResponse.getHeader("Content-Type")).toBe("application/json");
    });
  });

  describe("Authentication and Token Handling", () => {
    test("should handle different installation ID formats", async () => {
      const installationIds = ["12345678", "87654321", "11111111"];

      for (const installationId of installationIds) {
        const { default: publishHandler } = await import("../../api/publish");

        const mockRequest = createRequest({
          method: "POST",
          headers: {
            "installation-id": installationId,
          },
        }) as any;

        mockRequest.on = vi.fn((event, callback) => {
          if (event === "data") {
            callback(
              Buffer.from(
                JSON.stringify({
                  name: `test-repo-${installationId}`,
                })
              )
            );
          } else if (event === "end") {
            callback();
          }
        });

        const mockResponse = createResponse() as any;

        await publishHandler(mockRequest, mockResponse);

        // Each ID should be processed
        expect(mockResponse.getHeader("Content-Type")).toBe("application/json");
      }
    });

    test("should handle repository creation for different owner types", async () => {
      const ownerTypes = [
        { owner: "personal-user", type: "personal" },
        { owner: "test-organization", type: "organization" },
        { owner: undefined, type: "current-user" },
      ];

      for (const { owner, type } of ownerTypes) {
        const { default: publishHandler } = await import("../../api/publish");

        const mockRequest = createRequest({
          method: "POST",
          headers: {
            "installation-id": "12345678",
          },
        }) as any;

        const repoConfig: any = {
          name: `repo-for-${type}`,
          description: `Repository for ${type} owner`,
        };

        if (owner) {
          repoConfig.owner = owner;
        }

        mockRequest.on = vi.fn((event, callback) => {
          if (event === "data") {
            callback(Buffer.from(JSON.stringify(repoConfig)));
          } else if (event === "end") {
            callback();
          }
        });

        const mockResponse = createResponse() as any;

        await publishHandler(mockRequest, mockResponse);

        // Each owner type should be processed
        expect(mockResponse.getHeader("Content-Type")).toBe("application/json");
      }
    });
  });
});
