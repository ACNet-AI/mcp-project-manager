import { describe, test, expect, beforeEach, vi } from "vitest";
import type { Context } from "probot";
import {
  getRepoInfo,
  createUserRepository,
  checkRepositoryExists,
  pushFilesToRepository,
  createIssue,
  createComment,
  getFileContent,
  registerToHub,
  reportError,
  LABELS,
} from "../../src/utils/github";

// Mock context helper
function createMockContext(): any {
  const mockLog = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };

  return {
    octokit: {
      repos: {
        get: vi.fn(),
        createForAuthenticatedUser: vi.fn(),
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
      issues: {
        create: vi.fn(),
        createComment: vi.fn(),
      },
    },
    payload: {
      repository: {
        owner: { login: "testuser" },
        name: "test-repo",
      },
    },
    log: mockLog,
  };
}

describe("GitHub Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRepoInfo", () => {
    test("should extract repo info from context", () => {
      const context = createMockContext();
      const repoInfo = getRepoInfo(context);

      expect(repoInfo).toEqual({
        owner: "testuser",
        repo: "test-repo",
        fullName: "testuser/test-repo",
      });
    });
  });

  describe("createUserRepository", () => {
    test("should create repository with default options", async () => {
      const context = createMockContext();
      const mockCreate = vi.fn().mockResolvedValue({
        data: {
          name: "new-repo",
          html_url: "https://github.com/testuser/new-repo",
          full_name: "testuser/new-repo",
        },
      });
      context.octokit.repos.createForAuthenticatedUser = mockCreate;

      const result = await createUserRepository(context, "new-repo");

      expect(mockCreate).toHaveBeenCalledWith({
        name: "new-repo",
        description: "MCP server project: new-repo",
        private: false,
        auto_init: true,
        gitignore_template: "Node",
        license_template: "mit",
      });
      expect(result.name).toBe("new-repo");
    });

    test("should create repository with custom options", async () => {
      const context = createMockContext();
      const mockCreate = vi.fn().mockResolvedValue({
        data: {
          name: "private-repo",
          html_url: "https://github.com/testuser/private-repo",
          full_name: "testuser/private-repo",
        },
      });
      context.octokit.repos.createForAuthenticatedUser = mockCreate;

      const options = {
        description: "Test repo",
        private: true,
        autoInit: false,
        gitignoreTemplate: "Python",
        licenseTemplate: "apache-2.0",
      };

      await createUserRepository(context, "private-repo", options);

      expect(mockCreate).toHaveBeenCalledWith({
        name: "private-repo",
        description: "Test repo",
        private: true,
        auto_init: false,
        gitignore_template: "Python",
        license_template: "apache-2.0",
      });
    });
  });

  describe("checkRepositoryExists", () => {
    test("should return true if repository exists", async () => {
      const context = createMockContext();
      const mockGet = vi
        .fn()
        .mockResolvedValue({ data: { name: "test-repo" } });
      context.octokit.repos.get = mockGet;

      const exists = await checkRepositoryExists(
        context,
        "testuser",
        "test-repo"
      );

      expect(exists).toBe(true);
      expect(mockGet).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
      });
    });

    test("should return false if repository does not exist", async () => {
      const context = createMockContext();
      const mockGet = vi.fn().mockRejectedValue({ status: 404 });
      context.octokit.repos.get = mockGet;

      const exists = await checkRepositoryExists(
        context,
        "testuser",
        "nonexistent-repo"
      );

      expect(exists).toBe(false);
    });

    test("should throw error for non-404 errors", async () => {
      const context = createMockContext();
      const mockGet = vi
        .fn()
        .mockRejectedValue({ status: 500, message: "Server error" });
      context.octokit.repos.get = mockGet;

      await expect(
        checkRepositoryExists(context, "testuser", "test-repo")
      ).rejects.toEqual({
        status: 500,
        message: "Server error",
      });
    });
  });

  describe("pushFilesToRepository", () => {
    test("should push files to repository", async () => {
      const context = createMockContext();
      const mockGet = vi.fn().mockResolvedValue({
        data: { default_branch: "main" },
      });
      const mockCreateOrUpdate = vi.fn().mockResolvedValue({});

      context.octokit.repos.get = mockGet;
      context.octokit.repos.createOrUpdateFileContents = mockCreateOrUpdate;

      const files = [
        { path: "test.txt", content: "Hello World", message: "Add test file" },
        { path: "config.json", content: "{\"test\": true}" },
      ];

      await pushFilesToRepository(context, "testuser", "test-repo", files);

      expect(mockGet).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
      });
      expect(mockCreateOrUpdate).toHaveBeenCalledTimes(2);
      expect(mockCreateOrUpdate).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        path: "test.txt",
        message: "Add test file",
        content: Buffer.from("Hello World").toString("base64"),
        branch: "main",
      });
    });
  });

  describe("createIssue", () => {
    test("should create issue", async () => {
      const context = createMockContext();
      const mockCreate = vi.fn().mockResolvedValue({
        data: { number: 1, title: "Test Issue" },
      });
      context.octokit.issues.create = mockCreate;

      const result = await createIssue(context, "Test Issue", "Test body", [
        "bug",
      ]);

      expect(mockCreate).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        title: "Test Issue",
        body: "Test body",
        labels: ["bug"],
      });
      expect(result.data.number).toBe(1);
    });

    test("should handle issue creation error", async () => {
      const context = createMockContext();
      const mockCreate = vi.fn().mockRejectedValue(new Error("API Error"));
      context.octokit.issues.create = mockCreate;

      await expect(
        createIssue(context, "Test Issue", "Test body")
      ).rejects.toThrow("API Error");
      expect(context.log.error).toHaveBeenCalled();
    });
  });

  describe("createComment", () => {
    test("should create comment", async () => {
      const context = createMockContext();
      const mockCreateComment = vi.fn().mockResolvedValue({
        data: { id: 1, body: "Test comment" },
      });
      context.octokit.issues.createComment = mockCreateComment;

      const result = await createComment(context, 1, "Test comment");

      expect(mockCreateComment).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        issue_number: 1,
        body: "Test comment",
      });
      expect(result.data.id).toBe(1);
    });
  });

  describe("getFileContent", () => {
    test("should get file content", async () => {
      const context = createMockContext();
      const mockGetContent = vi.fn().mockResolvedValue({
        data: {
          type: "file",
          content: Buffer.from("file content").toString("base64"),
        },
      });
      context.octokit.repos.getContent = mockGetContent;

      const content = await getFileContent(context, "test.txt");

      expect(content).toBe("file content");
      expect(mockGetContent).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        path: "test.txt",
      });
    });

    test("should handle file not found", async () => {
      const context = createMockContext();
      const mockGetContent = vi.fn().mockRejectedValue({ status: 404 });
      context.octokit.repos.getContent = mockGetContent;

      const content = await getFileContent(context, "nonexistent.txt");

      expect(content).toBe(null);
      expect(context.log.error).toHaveBeenCalled();
    });

    test("should handle directory instead of file", async () => {
      const context = createMockContext();
      const mockGetContent = vi.fn().mockResolvedValue({
        data: [{ name: "file1.txt" }, { name: "file2.txt" }],
      });
      context.octokit.repos.getContent = mockGetContent;

      const content = await getFileContent(context, "directory");

      expect(content).toBe(null);
      expect(context.log.error).toHaveBeenCalled();
    });
  });

  describe("registerToHub", () => {
    test.skip("should register project to hub via PR", async () => {
      const context = createMockContext();

      // Mock GitHub API calls for registration
      const mockGetContent = vi
        .fn()
        .mockResolvedValueOnce({
          data: { content: Buffer.from("[]").toString("base64") },
        })
        .mockResolvedValueOnce({
          data: { sha: "file-sha-123" },
        });

      const mockGetBranch = vi.fn().mockResolvedValue({
        data: { commit: { sha: "main-sha-123" } },
      });

      const mockCreateRef = vi.fn().mockResolvedValue({});
      const mockCreateOrUpdateFile = vi.fn().mockResolvedValue({});
      const mockCreatePull = vi.fn().mockResolvedValue({
        data: {
          number: 42,
          html_url: "https://github.com/ACNet-AI/mcp-servers-hub/pull/42",
        },
      });

      // Set up the full mock structure
      context.octokit.rest = {
        repos: {
          getContent: mockGetContent,
          getBranch: mockGetBranch,
          createOrUpdateFileContents: mockCreateOrUpdateFile,
        },
        git: {
          createRef: mockCreateRef,
        },
        pulls: {
          create: mockCreatePull,
        },
      };

      const projectInfo = {
        name: "test-mcp-server",
        author: "testuser",
        description: "Test MCP server",
        repository: "https://github.com/testuser/test-mcp-server",
        category: "server" as const,
        status: "approved" as const,
        version: "1.0.0",
        registered_at: new Date().toISOString(),
        tags: ["mcp", "server"],
        dependencies: [],
      };

      const result = await registerToHub(context, projectInfo);

      expect(result.success).toBe(true);
      expect(result.url).toBe(
        "https://github.com/ACNet-AI/mcp-servers-hub/pull/42"
      );
      expect(context.log.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Attempting to register test-mcp-server to MCP Servers Hub"
        )
      );
      expect(mockCreatePull).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "ACNet-AI",
          repo: "mcp-servers-hub",
          title: expect.stringContaining("🚀 Register test-mcp-server"),
        })
      );
    });

    test.skip("should handle registration errors gracefully", async () => {
      const context = createMockContext();

      // Mock GitHub API error - first call fails, causing registration to fail
      const mockGetContentError = vi
        .fn()
        .mockRejectedValue(new Error("API Error"));

      context.octokit.rest = {
        repos: {
          getContent: mockGetContentError,
          getBranch: vi
            .fn()
            .mockResolvedValue({ data: { commit: { sha: "test" } } }),
          createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
        },
        git: {
          createRef: vi.fn().mockResolvedValue({}),
        },
        pulls: {
          create: vi
            .fn()
            .mockResolvedValue({ data: { number: 1, html_url: "test" } }),
        },
      };

      const projectInfo = {
        name: "test-server",
        description: "Test server",
        repository: "https://github.com/testuser/test-server",
        version: "1.0.0",
        language: "python" as const,
        category: "tools" as const,
        tags: ["test"],
      };

      const result = await registerToHub(context, projectInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain("API Error");
      expect(context.log.error).toHaveBeenCalled();
    });
  });

  describe("reportError", () => {
    test("should log error without creating issue", async () => {
      const context = createMockContext();
      const error = new Error("Test error");

      await reportError(context, "test action", error, false);

      expect(context.log.error).toHaveBeenCalledWith(
        "test action failed: Test error"
      );
    });

    test("should create issue when requested", async () => {
      const context = createMockContext();
      const mockCreate = vi.fn().mockResolvedValue({
        data: { number: 1, title: "🚨 Automation Error: test action" },
      });
      context.octokit.issues.create = mockCreate;

      await reportError(context, "test action", new Error("Test error"), true);

      expect(context.log.error).toHaveBeenCalledWith(
        "test action failed: Test error"
      );
      expect(mockCreate).toHaveBeenCalledWith({
        owner: "testuser",
        repo: "test-repo",
        title: "🚨 Automation Error: test action",
        body: expect.stringContaining("An error occurred during test action"),
        labels: ["bug", "automation"],
      });
    });
  });

  describe("LABELS", () => {
    test("should define all required labels", () => {
      expect(LABELS).toEqual({
        MCP_SERVER: "mcp-server",
        VALIDATION_PASSED: "validation-passed",
        VALIDATION_FAILED: "validation-failed",
        AUTO_MERGED: "auto-merged",
        NEEDS_REVIEW: "needs-review",
        BUG: "bug",
        AUTOMATION: "automation",
        AUTO_REGISTERED: "auto-registered",
        MANUAL_REVIEW: "manual-review",
        REGISTRATION_PENDING: "registration-pending",
        REGISTRATION_READY: "registration-ready",
        WELCOME: "welcome",
      });
    });
  });
});
